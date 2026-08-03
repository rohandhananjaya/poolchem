/**
 * High-level email notifications for app events.
 *
 * The counterpart to `@/lib/push/notify` — this is the only module pages and
 * actions import for sending a transactional email. It resolves the recipient
 * (who to notify) and the payload (what to say), then hands off to `sendEmail`
 * for delivery. It never touches Prisma directly and **never throws** — a
 * notification failure must never take down the action that triggered it.
 */
import "server-only";

import { getCompanyById, getCompanyFromEmail } from "@/lib/db/company";
import { getVisitById } from "@/lib/db/visits";
import { logger } from "@/lib/log";
import { sendEmail } from "@/lib/email";
import {
  buildVisitAssignedEmail,
  buildVisitCancelledEmail,
  buildReportShareEmail,
  buildInvitationEmail,
  buildWelcomeEmail,
  buildConfirmSignupEmail,
  buildPasswordResetEmail,
  buildPaymentReceiptEmail,
  buildSubscriptionCancelledEmail,
  buildTrialExpiringEmail,
  buildTrialExpiredEmail,
  buildDowngradeScheduledEmail,
  buildFeedbackAlertEmail,
} from "./templates";

/** Absolute app origin used to build email links. */
function getOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000";
}

/** Platform-level "from" for emails that aren't tied to one company. */
function getPlatformFrom(): string {
  return process.env.EMAIL_FROM ?? "noreply@poolbench.com";
}

/**
 * Fire-and-forget delivery: sends the email, logs failures, and never
 * propagates. The `label` makes log lines greppable.
 */
async function safeSend(
  label: string,
  input: { to: string; from: string; subject: string; html: string },
): Promise<void> {
  try {
    const result = await sendEmail(input);
    if (!result.ok) {
      logger.error(`Email "${label}" send failed`, {
        context: "email.notify",
        metadata: { to: input.to, error: result.error },
      });
    }
  } catch (err) {
    logger.error(`Email "${label}" threw`, {
      context: "email.notify",
      metadata: { to: input.to, error: String(err) },
    });
  }
}

/** Sends a welcome email to a newly created account (company owner or platform admin). */
export async function notifyWelcome(input: {
  to: string;
  name: string;
  companyName?: string | null;
}): Promise<void> {
  const email = buildWelcomeEmail({
    to: input.to,
    from: getPlatformFrom(),
    name: input.name,
    companyName: input.companyName ?? null,
    dashboardUrl: `${getOrigin()}/dashboard`,
  });
  await safeSend("welcome", email);
}

/** Sends a signup confirmation link to a newly created (unconfirmed) account. */
export async function notifyConfirmSignup(input: {
  to: string;
  name: string;
  confirmUrl: string;
}): Promise<void> {
  const email = buildConfirmSignupEmail({
    to: input.to,
    from: getPlatformFrom(),
    name: input.name,
    confirmUrl: input.confirmUrl,
  });
  await safeSend("confirm_signup", email);
}

/** Sends a password-reset link. */
export async function notifyPasswordReset(input: {
  to: string;
  resetUrl: string;
}): Promise<void> {
  const email = buildPasswordResetEmail({
    to: input.to,
    from: getPlatformFrom(),
    resetUrl: input.resetUrl,
  });
  await safeSend("password_reset", email);
}

/**
 * Sends a team invitation to join a company. No-ops when the company can't be
 * found (it was just created, so that shouldn't happen).
 */
export async function notifyInvitation(input: {
  companyId: string;
  to: string;
  inviteUrl: string;
}): Promise<void> {
  const company = await getCompanyById(input.companyId);
  if (!company) return;

  const email = buildInvitationEmail({
    to: input.to,
    from: getCompanyFromEmail(company),
    companyName: company.name,
    inviteUrl: input.inviteUrl,
  });
  await safeSend("invitation", email);
}

/**
 * Sends a "new visit assigned" email to a tech. Mirrors `push/notify`'s
 * `notifyVisitAssigned`: safe to call after any visit create/update, no-ops
 * when there's no tech, the assignee is unchanged, the visit isn't found, or
 * the tech has no email.
 */
export async function notifyVisitAssigned(input: {
  companyId: string;
  visitId: string;
  techId: string | null;
  previousTechId?: string | null;
}): Promise<void> {
  if (!input.techId || input.techId === input.previousTechId) return;

  const visit = await getVisitById(input.visitId, input.companyId);
  if (!visit || !visit.tech?.email) return;

  const company = await getCompanyById(input.companyId);
  const email = buildVisitAssignedEmail({
    to: visit.tech.email,
    from: company ? getCompanyFromEmail(company) : getPlatformFrom(),
    techName: visit.tech.name,
    poolName: visit.pool.name,
    address: visit.pool.address,
    scheduledDate: visit.scheduledAt
      ? new Date(visit.scheduledAt).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : null,
    visitUrl: `${getOrigin()}/visits/${input.visitId}`,
  });
  await safeSend("visit_assigned", email);
}

/** Sends a "visit cancelled" email to the assigned tech, when one is set. */
export async function notifyVisitCancelled(input: {
  companyId: string;
  visitId: string;
  reason: string;
}): Promise<void> {
  const visit = await getVisitById(input.visitId, input.companyId);
  if (!visit || !visit.tech?.email) return;

  const company = await getCompanyById(input.companyId);
  const email = buildVisitCancelledEmail({
    to: visit.tech.email,
    from: company ? getCompanyFromEmail(company) : getPlatformFrom(),
    techName: visit.tech.name,
    poolName: visit.pool.name,
    reason: input.reason,
    scheduleUrl: `${getOrigin()}/schedule`,
  });
  await safeSend("visit_cancelled", email);
}

/**
 * Sends a completed visit's shareable report to a homeowner. Resolves the
 * report link server-side so no caller has to build it.
 */
export async function notifyReportAvailable(input: {
  companyId: string;
  visitId: string;
  to: string;
}): Promise<void> {
  const visit = await getVisitById(input.visitId, input.companyId);
  if (!visit) return;

  const company = await getCompanyById(input.companyId);
  const reportUrl = visit.publicToken
    ? `${getOrigin()}/report/${visit.publicToken}`
    : `${getOrigin()}/visits/${input.visitId}/report`;

  const email = buildReportShareEmail({
    to: input.to,
    from: company ? getCompanyFromEmail(company) : getPlatformFrom(),
    companyName: company?.name ?? "Your pool service provider",
    poolName: visit.pool.name,
    reportUrl,
  });
  await safeSend("report_available", email);
}

/** Sends a payment receipt after a successful payment or plan change. */
export async function notifyPaymentSuccess(input: {
  to: string;
  companyName: string;
  packageName: string;
  amount?: number;
}): Promise<void> {
  const email = buildPaymentReceiptEmail({
    to: input.to,
    from: getPlatformFrom(),
    companyName: input.companyName,
    packageName: input.packageName,
    amount: input.amount,
    invoiceUrl: `${getOrigin()}/account/package`,
  });
  await safeSend("payment_success", email);
}

/** Sends a confirmation when a subscription is cancelled. */
export async function notifySubscriptionCancelled(input: {
  to: string;
  companyName: string;
  packageName?: string | null;
}): Promise<void> {
  const email = buildSubscriptionCancelledEmail({
    to: input.to,
    from: getPlatformFrom(),
    companyName: input.companyName,
    packageName: input.packageName ?? null,
    packageUrl: `${getOrigin()}/account/package`,
  });
  await safeSend("subscription_cancelled", email);
}

/** Sends a reminder that a trial is about to expire. */
export async function notifyTrialExpiring(input: {
  to: string;
  companyName: string;
  trialEnd: Date;
}): Promise<void> {
  const email = buildTrialExpiringEmail({
    to: input.to,
    from: getPlatformFrom(),
    companyName: input.companyName,
    trialEnd: input.trialEnd.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    packageUrl: `${getOrigin()}/account/package`,
  });
  await safeSend("trial_expiring", email);
}

/** Sends a notice that a trial has expired. */
export async function notifyTrialExpired(input: {
  to: string;
  companyName: string;
}): Promise<void> {
  const email = buildTrialExpiredEmail({
    to: input.to,
    from: getPlatformFrom(),
    companyName: input.companyName,
    packageUrl: `${getOrigin()}/account/package`,
  });
  await safeSend("trial_expired", email);
}

/** Sends a confirmation that a downgrade has been scheduled. */
export async function notifyDowngradeScheduled(input: {
  to: string;
  companyName: string;
  currentPackageName: string;
  targetPackageName: string;
  effectiveAt: Date;
}): Promise<void> {
  const email = buildDowngradeScheduledEmail({
    to: input.to,
    from: getPlatformFrom(),
    companyName: input.companyName,
    currentPackageName: input.currentPackageName,
    targetPackageName: input.targetPackageName,
    effectiveAt: input.effectiveAt.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    packageUrl: `${getOrigin()}/account/package`,
  });
  await safeSend("downgrade_scheduled", email);
}

/** Alerts a platform admin about a new feedback submission. */
export async function notifyFeedbackAlert(input: {
  to: string;
  type: string;
  title: string;
  description: string;
  submitterName: string;
  submitterEmail: string;
  companyName?: string | null;
}): Promise<void> {
  const email = buildFeedbackAlertEmail({
    to: input.to,
    from: getPlatformFrom(),
    type: input.type,
    title: input.title,
    description: input.description,
    submitterName: input.submitterName,
    submitterEmail: input.submitterEmail,
    companyName: input.companyName ?? null,
    adminUrl: `${getOrigin()}/admin/feedback`,
  });
  await safeSend("feedback_alert", email);
}
