import "server-only";

import type { PaymentTransaction, VisitPaymentStatus } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { getDefaultFeePercent } from "@/lib/db/packages"
import { computeFeeAmount } from "@/lib/db/payment-transactions"
import { logger } from "@/lib/log"

/**
 * Visit-scoped payment writes (Epic 1: Payments-as-a-Service). A card-present
 * charge lands as a `PaymentTransaction` linked to the visit, and flips the
 * visit's `paymentStatus` to `PAID`. Every helper is tenant-scoped via the
 * visit's pool, matching the `ServiceVisit` convention (no own `companyId`).
 */

/**
 * Scoped read: returns the visit's payment status for the tenant, or `null`
 * on a cross-tenant miss.
 */
export async function getVisitPaymentStatus(
  visitId: string,
  companyId: string,
): Promise<VisitPaymentStatus | null> {
  const visit = await prisma.serviceVisit.findFirst({
    where: { id: visitId, pool: { companyId } },
    select: { paymentStatus: true },
  })
  return visit?.paymentStatus ?? null
}

/** Marks a visit `PAID`. Throws on a cross-tenant miss. */
export async function markVisitPaid(
  visitId: string,
  companyId: string,
): Promise<void> {
  const existing = await prisma.serviceVisit.findFirst({
    where: { id: visitId, pool: { companyId } },
    select: { id: true },
  })
  if (!existing) throw new Error("Visit not found.")

  await prisma.serviceVisit.update({
    where: { id: visitId },
    data: { paymentStatus: "PAID" },
  })
}

/**
 * Records a successful card-present payment for a visit: creates the
 * `PaymentTransaction` (fee % snapshotted), marks it `PAID`, and flips the
 * visit's `paymentStatus` to `PAID`. Returns the transaction.
 */
export async function recordVisitPayment({
  companyId,
  visitId,
  amount,
}: {
  companyId: string
  visitId: string
  amount: number
}): Promise<PaymentTransaction> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Transaction amount must be a positive number of cents.")
  }

  const visit = await prisma.serviceVisit.findFirst({
    where: { id: visitId, pool: { companyId } },
    select: { id: true },
  })
  if (!visit) throw new Error("Visit not found.")

  const feePercent = await getDefaultFeePercent()
  const roundedAmount = Math.round(amount)
  const t = await prisma.paymentTransaction.create({
    data: {
      companyId,
      visitId,
      amount: roundedAmount,
      feePercent,
      feeAmount: computeFeeAmount(roundedAmount, feePercent),
      status: "PAID",
      paidAt: new Date(),
    },
  })

  await prisma.serviceVisit.update({
    where: { id: visitId },
    data: { paymentStatus: "PAID" },
  })

  logger.info("Card-present payment captured for visit", {
    context: "visit-payments.recordVisitPayment",
    companyId,
    metadata: { visitId, transactionId: t.id, amount: t.amount, feeAmount: t.feeAmount },
  })

  return t
}
