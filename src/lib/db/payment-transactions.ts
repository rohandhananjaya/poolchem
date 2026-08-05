import "server-only"

import type { PaymentTransaction, TransactionStatus } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { getDefaultFeePercent } from "@/lib/db/packages"
import { logger } from "@/lib/log"

export interface PaymentTransactionInfo {
  id: string
  amount: number
  feePercent: number
  feeAmount: number
  status: TransactionStatus
  paidAt: Date | null
  createdAt: Date
}

/** Pure fee math: basis points → cents earned, rounded to the cent. */
export function computeFeeAmount(amountCents: number, feeBasisPoints: number): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0
  if (!Number.isFinite(feeBasisPoints) || feeBasisPoints <= 0) return 0
  return Math.round((amountCents * feeBasisPoints) / 10000)
}

function toTransactionInfo(t: PaymentTransaction): PaymentTransactionInfo {
  return {
    id: t.id,
    amount: t.amount,
    feePercent: t.feePercent,
    feeAmount: t.feeAmount,
    status: t.status,
    paidAt: t.paidAt,
    createdAt: t.createdAt,
  }
}

/**
 * Records a card transaction and auto-applies the platform's current flat %
 * processing fee (snapshotted so later fee changes never rewrite history).
 * New transactions start `PENDING`; real card capture (card-present payments)
 * marks them paid once the processor confirms.
 */
export async function recordTransaction({
  companyId,
  amount,
  visitId,
}: {
  companyId: string
  amount: number
  visitId?: string
}): Promise<PaymentTransactionInfo> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Transaction amount must be a positive number of cents.")
  }

  const feePercent = await getDefaultFeePercent()
  const t = await prisma.paymentTransaction.create({
    data: {
      companyId,
      visitId,
      amount: Math.round(amount),
      feePercent,
      feeAmount: computeFeeAmount(amount, feePercent),
    },
  })
  return toTransactionInfo(t)
}

/** Marks a pending transaction paid — tenant-scoped; throws on a cross-tenant miss. */
export async function markTransactionPaid(
  transactionId: string,
  companyId: string,
): Promise<PaymentTransactionInfo> {
  const existing = await prisma.paymentTransaction.findUnique({ where: { id: transactionId } })
  if (!existing) throw new Error("Transaction not found.")
  if (existing.companyId !== companyId) {
    throw new Error("Transaction not found.")
  }

  const t = await prisma.paymentTransaction.update({
    where: { id: transactionId },
    data: { status: "PAID", paidAt: new Date() },
  })
  return toTransactionInfo(t)
}

/** A company's transactions, newest first. */
export async function getCompanyTransactions(
  companyId: string,
  limit = 20,
): Promise<PaymentTransactionInfo[]> {
  const rows = await prisma.paymentTransaction.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  return rows.map(toTransactionInfo)
}

/**
 * Dev/no-real-reader stand-in for capturing a card payment, mirroring
 * `simulatePayment`: records the transaction (with the auto-applied fee) and
 * immediately marks it paid. Exercise of the fee engine until card-present
 * capture (Epic 1 card 1) lands.
 */
export async function simulateTransaction(
  companyId: string,
  amount: number,
): Promise<PaymentTransactionInfo> {
  const recorded = await recordTransaction({ companyId, amount })
  logger.info("Simulated card transaction captured", {
    context: "payment-transactions.simulateTransaction",
    companyId,
    metadata: { transactionId: recorded.id, amount: recorded.amount, feeAmount: recorded.feeAmount },
  })
  return markTransactionPaid(recorded.id, companyId)
}
