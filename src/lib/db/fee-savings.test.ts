import { describe, expect, it, beforeEach, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/platform-settings", () => ({
  getPlatformSettings: vi.fn(),
}));

const {
  getFeeSavingsData,
  estimateLegacyCostCents,
} = await import("@/lib/db/fee-savings");
const { getPlatformSettings } = await import("@/lib/db/platform-settings");

const now = new Date();
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

function paidTransaction(feeAmount: number, paidAt: Date) {
  return { id: "txn", feeAmount, paidAt, status: "PAID" };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPlatformSettings).mockResolvedValue({
    trialDays: 30,
    stripeEnabled: false,
    paypalEnabled: false,
    paymentDevMode: true,
    feeBasedBilling: true,
    legacyPerPoolRate: 2500,
  } as never);
});

describe("estimateLegacyCostCents", () => {
  it("multiplies active pools by the per-pool rate", () => {
    expect(estimateLegacyCostCents(4, 2500)).toBe(10000);
  });

  it("returns 0 for non-finite or negative inputs", () => {
    expect(estimateLegacyCostCents(-1, 2500)).toBe(0);
    expect(estimateLegacyCostCents(4, -1)).toBe(0);
    expect(estimateLegacyCostCents(Number.NaN, 2500)).toBe(0);
  });
});

describe("getFeeSavingsData", () => {
  it("computes MTD fees, old-model estimate and trend buckets", async () => {
    prismaMock.pool.count.mockResolvedValue(4);
    const thisMonth = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 10);
    prismaMock.paymentTransaction.findMany.mockResolvedValue([
      paidTransaction(500, thisMonth),
      paidTransaction(300, thisMonth),
      paidTransaction(1200, lastMonth),
      paidTransaction(100, twoMonthsAgo),
    ] as never);

    const data = await getFeeSavingsData(6);

    expect(prismaMock.paymentTransaction.findMany).toHaveBeenCalledWith({
      where: {
        status: "PAID",
        paidAt: { gte: monthStart(new Date(now.getFullYear(), now.getMonth() - 5, 1)) },
      },
      select: { feeAmount: true, paidAt: true },
    });

    expect(data.monthToDateFeesCents).toBe(800);
    expect(data.monthToDateOldModelCents).toBe(10000);
    expect(data.monthToDateSavingsCents).toBe(9200);
    expect(data.legacyPerPoolRate).toBe(2500);
    expect(data.activePools).toBe(4);

    expect(data.trend).toHaveLength(6);
    const lastBucket = data.trend[data.trend.length - 1];
    expect(lastBucket.feesCents).toBe(800);
    expect(lastBucket.oldModelCents).toBe(10000);
    const prevBucket = data.trend[data.trend.length - 2];
    expect(prevBucket.feesCents).toBe(1200);
  });

  it("does not count non-paid transactions toward fees", async () => {
    prismaMock.pool.count.mockResolvedValue(0);
    prismaMock.paymentTransaction.findMany.mockResolvedValue([] as never);

    const data = await getFeeSavingsData(6);

    expect(data.monthToDateFeesCents).toBe(0);
    expect(data.trend.every((t) => t.feesCents === 0)).toBe(true);
  });
});
