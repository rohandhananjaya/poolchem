"use server";

import { revalidatePath } from "next/cache";

import { requireTech } from "@/lib/auth";
import {
  assertVisitAccess,
  cancelVisit,
  completeVisit,
  getVisitById,
  saveDraftVisit,
  startVisit,
  updateVisitStatus,
  type VisitReadings,
  type VisitChemical,
} from "@/lib/db/visits";
import { readingsSchema } from "@/lib/validation/visit-readings";
import { ServiceVisitStatus } from "@/generated/prisma/client";
import * as emailNotify from "@/lib/email/notify";
import { getCompanyById } from "@/lib/db/company";
import { recordVisitPayment } from "@/lib/db/visit-payments";
import { getCardPresentProvider } from "@/lib/payment/terminal";

export interface VisitFormValues {
  readings: VisitReadings;
  chemicals: VisitChemical[];
  notes: string;
  /** YYYY-MM-DD string, or undefined to leave unset. */
  nextServiceDate?: string;
}

export async function saveDraftAction(
  visitId: string,
  data: VisitFormValues,
) {
  const user = await requireTech();
  if (!user.companyId) throw new Error("No company affiliation.");
  readingsSchema.parse(data.readings);

  await assertVisitAccess(visitId, user.companyId, user.id);
  await saveDraftVisit(
    visitId,
    data.readings,
    data.chemicals,
    data.notes || null,
    data.nextServiceDate ? new Date(`${data.nextServiceDate}T12:00:00`) : null,
  );
  revalidatePath(`/visits/${visitId}`);
}

export async function completeVisitAction(
  visitId: string,
  data: VisitFormValues,
) {
  const user = await requireTech();
  if (!user.companyId) throw new Error("No company affiliation.");
  readingsSchema.parse(data.readings);

  await assertVisitAccess(visitId, user.companyId, user.id);
  const completed = await completeVisit(
    visitId,
    data.readings,
    data.chemicals,
    data.notes || null,
    data.nextServiceDate ? new Date(`${data.nextServiceDate}T12:00:00`) : null,
  );

  // Auto-send the shareable report to the pool's homeowner when one is set.
  const homeownerEmail = completed.visit?.pool.homeownerEmail;
  if (homeownerEmail) {
    await emailNotify.notifyReportAvailable({
      companyId: user.companyId,
      visitId,
      to: homeownerEmail,
    });
  }

  revalidatePath(`/visits/${visitId}`);
  revalidatePath("/schedule");
}

/**
 * Sets a DRAFT visit to IN_PROGRESS. Returns `{ ok: true }` on success;
 * the client navigates to the visit form.
 */
export async function startVisitAction(visitId: string) {
  const user = await requireTech();
  if (!user.companyId) throw new Error("No company affiliation.");

  const result = await startVisit(visitId, user.companyId, user.id);
  if (!result) throw new Error("Visit not found or already started.");
  revalidatePath(`/visits/${visitId}`);
}

/**
 * Updates a visit's status from a dropdown. Only valid transitions
 * enforced server side.
 */
export async function updateVisitStatusAction(
  visitId: string,
  status: ServiceVisitStatus,
) {
  const user = await requireTech();
  if (!user.companyId) throw new Error("No company affiliation.");

  await assertVisitAccess(visitId, user.companyId, user.id);
  const result = await updateVisitStatus(visitId, user.companyId, status);
  if (!result) throw new Error("Visit not found.");
  revalidatePath(`/visits/${visitId}`);
}

export async function cancelVisitAction(visitId: string, reason: string) {
  const user = await requireTech();
  if (!user.companyId) throw new Error("No company affiliation.");

  await assertVisitAccess(visitId, user.companyId, user.id);
  const result = await cancelVisit(visitId, user.companyId, reason);
  if (!result) throw new Error("Visit not found.");
  await emailNotify.notifyVisitCancelled({
    companyId: user.companyId,
    visitId,
    reason,
  });
  revalidatePath(`/visits/${visitId}`);
}

export interface ChargeVisitResult {
  ok: true;
  transactionId: string;
  amount: number;
  feeAmount: number;
  captureMethod: "simulated" | "reader";
}

/**
 * Charges the customer's card for a visit at the equipment pad (Epic 1
 * Payments-as-a-Service). Captures via the card-present provider (dev mock
 * until a Stripe Terminal reader is wired), records the visit payment, marks
 * the visit paid, and emails the receipt to the pool's homeowner.
 */
export async function chargeVisitAction(
  visitId: string,
  amountCents: number,
): Promise<ChargeVisitResult> {
  const user = await requireTech();
  if (!user.companyId) throw new Error("No company affiliation.");

  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error("Charge amount must be a positive number of cents.");
  }

  const visit = await getVisitById(visitId, user.companyId);
  if (!visit) throw new Error("Visit not found.");

  await assertVisitAccess(visitId, user.companyId, user.id);
  if (visit.paymentStatus === "PAID") {
    throw new Error("This visit is already paid.");
  }

  const company = await getCompanyById(user.companyId);

  const { captureMethod } = await getCardPresentProvider().captureCharge({
    amountCents,
    description: `Pool service — ${visit.pool.name}`,
    connectedAccountId: company?.stripeConnectAccountId ?? null,
  });

  const tx = await recordVisitPayment({
    companyId: user.companyId,
    visitId,
    amount: amountCents,
  });

  if (visit.pool.homeownerEmail) {
    await emailNotify.notifyCustomerReceipt({
      companyId: user.companyId,
      visitId,
      to: visit.pool.homeownerEmail,
      amount: tx.amount / 100,
    });
  }

  revalidatePath(`/visits/${visitId}`);
  return { ok: true, transactionId: tx.id, amount: tx.amount, feeAmount: tx.feeAmount, captureMethod };
}
