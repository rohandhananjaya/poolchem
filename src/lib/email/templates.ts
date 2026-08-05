import "server-only";

export interface ReportShareEmailProps {
  to: string;
  from: string;
  companyName: string;
  poolName: string;
  reportUrl: string;
}

export function buildReportShareEmail(props: ReportShareEmailProps) {
  return {
    to: props.to,
    from: props.from,
    subject: `Service Report — ${props.poolName}`,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="padding:32px 24px 8px">
<h1 style="margin:0;font-size:20px;font-weight:600;color:#111">Pool Service Report</h1>
<p style="margin:8px 0 0;font-size:14px;color:#666">${props.companyName} has completed a service visit for <strong>${props.poolName}</strong>.</p>
</td></tr>
<tr><td style="padding:16px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="background:#0d9488;border-radius:8px;padding:12px 24px">
<a href="${props.reportUrl}" style="display:inline-block;font-size:15px;font-weight:600;color:#fff;text-decoration:none">View Full Report →</a>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:0 24px 24px">
<p style="margin:0;font-size:13px;color:#999;line-height:1.5">Or copy this link into your browser:<br>
<a href="${props.reportUrl}" style="color:#0d9488;word-break:break-all">${props.reportUrl}</a></p>
</td></tr>
<tr><td style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee">
<p style="margin:0;font-size:12px;color:#999">Sent via Poolbench · Your trusted pool service platform</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
  };
}

export interface InvitationEmailProps {
  to: string;
  from: string;
  companyName: string;
  inviteUrl: string;
}

/**
 * Escapes user-provided text so it can be safely interpolated into HTML email
 * bodies without breaking the layout or injecting markup.
 */
function esc(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Shared wrapper used by the newer templates — keeps layout consistent. */
function renderShell(opts: {
  heading: string;
  intro: string;
  body: string;
  cta?: { label: string; url: string } | null;
  footer?: string;
}): string {
  const ctaHtml = opts.cta
    ? `<tr><td style="padding:16px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="background:#0d9488;border-radius:8px;padding:12px 24px">
<a href="${opts.cta.url}" style="display:inline-block;font-size:15px;font-weight:600;color:#fff;text-decoration:none">${esc(opts.cta.label)} →</a>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:0 24px 24px">
<p style="margin:0;font-size:13px;color:#999;line-height:1.5">Or copy this link into your browser:<br>
<a href="${opts.cta.url}" style="color:#0d9488;word-break:break-all">${opts.cta.url}</a></p>
</td></tr>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="padding:32px 24px 8px">
<h1 style="margin:0;font-size:20px;font-weight:600;color:#111">${esc(opts.heading)}</h1>
<p style="margin:8px 0 0;font-size:14px;color:#666">${esc(opts.intro)}</p>
</td></tr>
<tr><td style="padding:16px 24px 8px">
<div style="font-size:14px;color:#444;line-height:1.6">${opts.body}</div>
</td></tr>
${ctaHtml}
<tr><td style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee">
<p style="margin:0;font-size:12px;color:#999">${esc(opts.footer ?? "Sent via Poolbench · Your trusted pool service platform")}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export interface WelcomeEmailProps {
  to: string;
  from: string;
  name: string;
  companyName?: string | null;
  dashboardUrl: string;
}

export function buildWelcomeEmail(props: WelcomeEmailProps) {
  const companyLine = props.companyName
    ? ` Your company <strong>${esc(props.companyName)}</strong> is set up and ready to go.`
    : "";
  return {
    to: props.to,
    from: props.from,
    subject: `Welcome to Poolbench, ${esc(props.name)}!`,
    html: renderShell({
      heading: "Welcome to Poolbench",
      intro: `Hi ${esc(props.name)}, your account is ready.`,
      body: `<p style="margin:0">Thanks for signing up!${companyLine}</p>
<p style="margin:12px 0 0">You now have full access during your trial. Add your pools, invite technicians, and schedule your first service visit.</p>`,
      cta: { label: "Go to your dashboard", url: props.dashboardUrl },
    }),
  };
}

export interface PasswordResetEmailProps {
  to: string;
  from: string;
  resetUrl: string;
}

export function buildPasswordResetEmail(props: PasswordResetEmailProps) {
  return {
    to: props.to,
    from: props.from,
    subject: "Reset your Poolbench password",
    html: renderShell({
      heading: "Reset your password",
      intro: "We received a request to reset your Poolbench password.",
      body: `<p style="margin:0">Click the button below to choose a new password. For your security, this link is single-use and expires soon.</p>
<p style="margin:12px 0 0">If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
      cta: { label: "Reset password", url: props.resetUrl },
    }),
  };
}

export interface ConfirmSignupEmailProps {
  to: string;
  from: string;
  name: string;
  confirmUrl: string;
}

export function buildConfirmSignupEmail(props: ConfirmSignupEmailProps) {
  return {
    to: props.to,
    from: props.from,
    subject: "Confirm your email to activate Poolbench",
    html: renderShell({
      heading: "Confirm your email",
      intro: `Hi ${esc(props.name)}, one more step before your account is ready.`,
      body: `<p style="margin:0">Click the button below to confirm your email address and activate your Poolbench account.</p>
<p style="margin:12px 0 0">If you didn't create this account, you can safely ignore this email.</p>`,
      cta: { label: "Confirm email address", url: props.confirmUrl },
    }),
  };
}

export interface VisitAssignedEmailProps {
  to: string;
  from: string;
  techName: string;
  poolName: string;
  address?: string | null;
  scheduledDate?: string | null;
  visitUrl: string;
}

export function buildVisitAssignedEmail(props: VisitAssignedEmailProps) {
  const location = props.address ? ` at ${esc(props.address)}` : "";
  const when = props.scheduledDate
    ? ` It's scheduled for <strong>${esc(props.scheduledDate)}</strong>.`
    : "";
  return {
    to: props.to,
    from: props.from,
    subject: `New visit assigned — ${esc(props.poolName)}`,
    html: renderShell({
      heading: "New visit assigned",
      intro: `Hi ${esc(props.techName)}, a service visit has been assigned to you.`,
      body: `<p style="margin:0">You've been assigned a service visit for <strong>${esc(props.poolName)}</strong>${location}.${when}</p>`,
      cta: { label: "View visit", url: props.visitUrl },
    }),
  };
}

export interface VisitCancelledEmailProps {
  to: string;
  from: string;
  techName: string;
  poolName: string;
  reason?: string | null;
  scheduleUrl: string;
}

export function buildVisitCancelledEmail(props: VisitCancelledEmailProps) {
  const reason = props.reason
    ? ` Reason: ${esc(props.reason)}`
    : "";
  return {
    to: props.to,
    from: props.from,
    subject: `Visit cancelled — ${esc(props.poolName)}`,
    html: renderShell({
      heading: "Visit cancelled",
      intro: `Hi ${esc(props.techName)}, a visit on your schedule was cancelled.`,
      body: `<p style="margin:0">The service visit for <strong>${esc(props.poolName)}</strong> has been cancelled.${reason}</p>`,
      cta: { label: "Open schedule", url: props.scheduleUrl },
    }),
  };
}

export interface PaymentReceiptEmailProps {
  to: string;
  from: string;
  companyName: string;
  packageName: string;
  amount?: number;
  invoiceUrl: string;
}export function buildPaymentReceiptEmail(props: PaymentReceiptEmailProps) {
  const amountLine =
    props.amount != null
      ? `<p style="margin:12px 0 0"><strong>${esc(props.packageName)}</strong> — ${esc(formatMoney(props.amount))}/month</p>`
      : `<p style="margin:12px 0 0"><strong>${esc(props.packageName)}</strong> is now active.</p>`;
  return {
    to: props.to,
    from: props.from,
    subject: `Payment receipt — ${esc(props.packageName)}`,
    html: renderShell({
      heading: "Payment received",
      intro: `Thanks for subscribing on behalf of ${esc(props.companyName)}.`,
      body: `<p style="margin:0">Your payment was successful and your plan is active.</p>${amountLine}
<p style="margin:12px 0 0">Your next billing date will be one month from today.</p>`,
      cta: { label: "View billing", url: props.invoiceUrl },
    }),
  };
}

export interface CardPaymentReceiptEmailProps {
  to: string;
  from: string;
  companyName: string;
  poolName: string;
  /** Amount charged, in whole dollars. */
  amount: number;
  reportUrl?: string;
}

export function buildCardPaymentReceiptEmail(props: CardPaymentReceiptEmailProps) {
  const reportCta = props.reportUrl
    ? { label: "View service report", url: props.reportUrl }
    : null;
  return {
    to: props.to,
    from: props.from,
    subject: `Payment receipt — ${esc(props.poolName)}`,
    html: renderShell({
      heading: "Payment received",
      intro: `Your card was charged by ${esc(props.companyName)}.`,
      body: `<p style="margin:0">Service visit for <strong>${esc(props.poolName)}</strong>.</p>
<p style="margin:12px 0 0;font-size:18px;font-weight:600;color:#111">${esc(formatMoney(props.amount))}</p>
<p style="margin:4px 0 0;font-size:12px;color:#999">Charged to your card at the equipment pad.</p>`,
      cta: reportCta,
    }),
  };
}

export interface SubscriptionCancelledEmailProps {
  to: string;
  from: string;
  companyName: string;
  packageName?: string | null;
  packageUrl: string;
}

export function buildSubscriptionCancelledEmail(props: SubscriptionCancelledEmailProps) {
  const plan = props.packageName
    ? ` Your <strong>${esc(props.packageName)}</strong> subscription has been cancelled.`
    : "";
  return {
    to: props.to,
    from: props.from,
    subject: "Your Poolbench subscription has been cancelled",
    html: renderShell({
      heading: "Subscription cancelled",
      intro: `Hi, this is a confirmation for ${esc(props.companyName)}.`,
      body: `<p style="margin:0">${plan}</p>
<p style="margin:12px 0 0">You'll keep access until the end of your current billing period. You can re-subscribe at any time.</p>`,
      cta: { label: "View plans", url: props.packageUrl },
    }),
  };
}

export interface TrialExpiringEmailProps {
  to: string;
  from: string;
  companyName: string;
  trialEnd: string;
  packageUrl: string;
}

export function buildTrialExpiringEmail(props: TrialExpiringEmailProps) {
  return {
    to: props.to,
    from: props.from,
    subject: "Your Poolbench trial ends soon",
    html: renderShell({
      heading: "Your trial ends soon",
      intro: `Your ${esc(props.companyName)} trial is expiring.`,
      body: `<p style="margin:0">Your free trial ends on <strong>${esc(props.trialEnd)}</strong>. Choose a plan to keep your pools, visits, and reports working without interruption.</p>`,
      cta: { label: "Choose a plan", url: props.packageUrl },
    }),
  };
}

export interface TrialExpiredEmailProps {
  to: string;
  from: string;
  companyName: string;
  packageUrl: string;
}

export function buildTrialExpiredEmail(props: TrialExpiredEmailProps) {
  return {
    to: props.to,
    from: props.from,
    subject: "Your Poolbench trial has ended",
    html: renderShell({
      heading: "Your trial has ended",
      intro: `The ${esc(props.companyName)} trial has ended.`,
      body: `<p style="margin:0">To keep using Poolbench — scheduling visits, recording water readings, and sending reports — choose a plan that fits.</p>`,
      cta: { label: "Choose a plan", url: props.packageUrl },
    }),
  };
}

export interface DowngradeScheduledEmailProps {
  to: string;
  from: string;
  companyName: string;
  currentPackageName: string;
  targetPackageName: string;
  effectiveAt: string;
  packageUrl: string;
}

export function buildDowngradeScheduledEmail(props: DowngradeScheduledEmailProps) {
  return {
    to: props.to,
    from: props.from,
    subject: `Plan change scheduled — ${esc(props.targetPackageName)}`,
    html: renderShell({
      heading: "Plan change scheduled",
      intro: `Hi, here's a confirmation for ${esc(props.companyName)}.`,
      body: `<p style="margin:0">Your plan will change from <strong>${esc(props.currentPackageName)}</strong> to <strong>${esc(props.targetPackageName)}</strong> on <strong>${esc(props.effectiveAt)}</strong>. You'll keep your current plan's features until then.</p>`,
      cta: { label: "View billing", url: props.packageUrl },
    }),
  };
}

export interface FeedbackAlertEmailProps {
  to: string;
  from: string;
  type: string;
  title: string;
  description: string;
  submitterName: string;
  submitterEmail: string;
  companyName?: string | null;
  adminUrl: string;
}

export function buildFeedbackAlertEmail(props: FeedbackAlertEmailProps) {
  const company = props.companyName
    ? ` from <strong>${esc(props.companyName)}</strong>`
    : "";
  return {
    to: props.to,
    from: props.from,
    subject: `New support request: ${esc(props.title)}`,
    html: renderShell({
      heading: "New support request",
      intro: `${esc(props.type)}${company}.`,
      body: `<p style="margin:0"><strong>${esc(props.title)}</strong></p>
<p style="margin:8px 0 0;color:#666">${esc(props.description)}</p>
<p style="margin:12px 0 0;font-size:13px;color:#666">Submitted by ${esc(props.submitterName)} &lt;${esc(props.submitterEmail)}&gt;</p>`,
      cta: { label: "Review in admin", url: props.adminUrl },
      footer: "Poolbench platform admin alert",
    }),
  };
}

/** Formats a plan price in whole dollars for receipt templates. */
function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function buildInvitationEmail(props: InvitationEmailProps) {
  return {
    to: props.to,
    from: props.from,
    subject: `You've been invited to join ${props.companyName}`,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="padding:32px 24px 8px">
<h1 style="margin:0;font-size:20px;font-weight:600;color:#111">You're Invited!</h1>
<p style="margin:8px 0 0;font-size:14px;color:#666">You have been invited to join <strong>${props.companyName}</strong> on Poolbench — the platform for managing pool service visits, water readings, and reports.</p>
</td></tr>
<tr><td style="padding:16px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="background:#0d9488;border-radius:8px;padding:12px 24px">
<a href="${props.inviteUrl}" style="display:inline-block;font-size:15px;font-weight:600;color:#fff;text-decoration:none">Accept Invitation →</a>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:0 24px 24px">
<p style="margin:0;font-size:13px;color:#999;line-height:1.5">Or copy this link into your browser:<br>
<a href="${props.inviteUrl}" style="color:#0d9488;word-break:break-all">${props.inviteUrl}</a></p>
</td></tr>
<tr><td style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee">
<p style="margin:0;font-size:12px;color:#999">Sent via Poolbench · Your trusted pool service platform</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
  };
}
