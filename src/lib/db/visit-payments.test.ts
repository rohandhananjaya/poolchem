import { describe, expect, it, beforeEach, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/packages", () => ({
  getDefaultFeePercent: mockGetDefaultFeePercent,
}));
vi.mock("@/lib/db/payment-transactions", () => ({
  computeFeeAmount: mockComputeFeeAmount,
}));

const mockLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
vi.mock("@/lib/log", () => ({ logger: mockLogger }));

const mockGetDefaultFeePercent = vi.fn();
const mockComputeFeeAmount = vi.fn();

const {
  getVisitPaymentStatus,
  markVisitPaid,
  recordVisitPayment,
} = await import("@/lib/db/visit-payments");

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDefaultFeePercent.mockResolvedValue(250);
  mockComputeFeeAmount.mockImplementation(
    (amountCents: number, feeBasisPoints: number) =>
      Math.round((amountCents * feeBasisPoints) / 10000),
  );
});

describe("getVisitPaymentStatus", () => {
  it("returns the visit's payment status for the tenant", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue({
      paymentStatus: "PAID",
    } as never);

    const status = await getVisitPaymentStatus("visit-1", "company-1");
    expect(status).toBe("PAID");
    expect(prismaMock.serviceVisit.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "visit-1", pool: { companyId: "company-1" } },
      }),
    );
  });

  it("returns null on a cross-tenant miss", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue(null);
    expect(await getVisitPaymentStatus("visit-1", "company-1")).toBeNull();
  });
});

describe("markVisitPaid", () => {
  it("marks the visit paid when it belongs to the tenant", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue({ id: "visit-1" } as never);
    prismaMock.serviceVisit.update.mockResolvedValue({} as never);

    await markVisitPaid("visit-1", "company-1");
    expect(prismaMock.serviceVisit.update).toHaveBeenCalledWith({
      where: { id: "visit-1" },
      data: { paymentStatus: "PAID" },
    });
  });

  it("throws on a cross-tenant miss", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue(null);
    await expect(markVisitPaid("visit-1", "company-1")).rejects.toThrow(
      "Visit not found.",
    );
    expect(prismaMock.serviceVisit.update).not.toHaveBeenCalled();
  });
});

describe("recordVisitPayment", () => {
  it("creates a PAID transaction with the fee and marks the visit paid", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue({ id: "visit-1" } as never);
    prismaMock.paymentTransaction.create.mockResolvedValue({
      id: "txn-1",
      companyId: "company-1",
      visitId: "visit-1",
      amount: 10000,
      feePercent: 250,
      feeAmount: 250,
      status: "PAID",
      paidAt: new Date(),
    } as never);
    prismaMock.serviceVisit.update.mockResolvedValue({} as never);

    const txn = await recordVisitPayment({
      companyId: "company-1",
      visitId: "visit-1",
      amount: 10000,
    });

    expect(txn.status).toBe("PAID");
    expect(prismaMock.paymentTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: "company-1",
          visitId: "visit-1",
          amount: 10000,
          feePercent: 250,
          feeAmount: 250,
          status: "PAID",
        }),
      }),
    );
    expect(prismaMock.serviceVisit.update).toHaveBeenCalledWith({
      where: { id: "visit-1" },
      data: { paymentStatus: "PAID" },
    });
  });

  it("rejects a non-positive amount", async () => {
    await expect(
      recordVisitPayment({ companyId: "company-1", visitId: "visit-1", amount: 0 }),
    ).rejects.toThrow("Transaction amount must be a positive number of cents.");
    expect(prismaMock.paymentTransaction.create).not.toHaveBeenCalled();
  });

  it("throws on a cross-tenant visit miss", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue(null);
    await expect(
      recordVisitPayment({ companyId: "company-1", visitId: "visit-1", amount: 5000 }),
    ).rejects.toThrow("Visit not found.");
    expect(prismaMock.paymentTransaction.create).not.toHaveBeenCalled();
  });
});
