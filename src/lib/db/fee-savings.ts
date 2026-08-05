import "server-only"

import { format } from "date-fns"

import { prisma } from "@/lib/prisma"
import { getPlatformSettings } from "@/lib/db/platform-settings"

export interface FeeSavingsTrendItem {
  /** Short month label, e.g. "Mar". */
  month: string
  /** Real platform fees collected that month, in cents (PAID transactions only). */
  feesCents: number
  /** Estimated cost under the retired per-pool model for that month, in cents. */
  oldModelCents: number
}

export interface FeeSavingsData {
  /** Real platform fees collected this calendar month, in cents. */
  monthToDateFeesCents: number
  /** Estimated old-model cost for this month, in cents. */
  monthToDateOldModelCents: number
  /** max(0, oldModel - fees), in cents. */
  monthToDateSavingsCents: number
  /** The last N months, oldest first. */
  trend: FeeSavingsTrendItem[]
  /** The configured estimate (cents per pool per month). */
  legacyPerPoolRate: number
  /** Current active pool count — basis of the old-model estimate. */
  activePools: number
}

const TREND_MONTHS = 6

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/**
 * Pure old-model cost estimate: monthly rate per pool × active pools, in cents.
 * The retired per-pool model is gone; this is a configurable proxy, not a
 * replay of real legacy billing.
 */
export function estimateLegacyCostCents(activePools: number, rateCents: number): number {
  if (!Number.isFinite(activePools) || activePools < 0) return 0
  if (!Number.isFinite(rateCents) || rateCents < 0) return 0
  return Math.round(activePools * rateCents)
}

/**
 * SUPER_ADMIN fee-vs-savings data (Epic 1, card 5). Compares real platform
 * processing fees against what the retired per-pool model would have cost.
 *
 * Real fees come from `PaymentTransaction.feeAmount` (PAID only). The old-model
 * estimate is `active pools × legacyPerPoolRate` — no per-company historical
 * pool counts are retained, so every month in the trend uses the current pool
 * count (a best-effort proxy).
 */
export async function getFeeSavingsData(
  months: number = TREND_MONTHS,
): Promise<FeeSavingsData> {
  const now = new Date()
  const mtdStart = monthStart(now)
  const trendStart = monthStart(
    new Date(now.getFullYear(), now.getMonth() - (months - 1), 1),
  )

  const [settings, activePools, paidTransactions] = await Promise.all([
    getPlatformSettings(),
    prisma.pool.count({ where: { isActive: true } }),
    prisma.paymentTransaction.findMany({
      where: { status: "PAID", paidAt: { gte: trendStart } },
      select: { feeAmount: true, paidAt: true },
    }),
  ])

  const paidInWindow = paidTransactions.filter(
    (t) => t.paidAt !== null && t.paidAt >= trendStart,
  )

  const monthToDateFeesCents = paidInWindow
    .filter((t) => t.paidAt !== null && t.paidAt >= mtdStart)
    .reduce((sum, t) => sum + t.feeAmount, 0)

  const monthToDateOldModelCents = estimateLegacyCostCents(
    activePools,
    settings.legacyPerPoolRate,
  )

  const byMonth = new Map<string, number>()
  for (const t of paidInWindow) {
    if (!t.paidAt) continue
    const key = `${t.paidAt.getFullYear()}-${t.paidAt.getMonth()}`
    byMonth.set(key, (byMonth.get(key) ?? 0) + t.feeAmount)
  }

  const buckets: { key: string; label: string }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: format(d, "MMM"),
    })
  }

  const trend: FeeSavingsTrendItem[] = buckets.map(({ key, label }) => ({
    month: label,
    feesCents: byMonth.get(key) ?? 0,
    oldModelCents: monthToDateOldModelCents,
  }))

  return {
    monthToDateFeesCents,
    monthToDateOldModelCents,
    monthToDateSavingsCents: Math.max(
      0,
      monthToDateOldModelCents - monthToDateFeesCents,
    ),
    trend,
    legacyPerPoolRate: settings.legacyPerPoolRate,
    activePools,
  }
}
