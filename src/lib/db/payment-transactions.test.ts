import { describe, expect, it, beforeEach, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/packages", () => ({
  getDefaultFeePercent: mockGetDefaultFeePercent,
}));

const mockLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
vi.mock("@/lib/log", () => ({ logger: mockLogger }));

const mockGetDefaultFeePercent = vi.fn();

const {
  recordTransaction,
  markTransactionPaid,
  getCompanyTransactions,
  simulateTransaction,
  computeFeeAmount,
} = await import("@/lib/db/payment-transactions");

const now = new Date("2026-01-15T00:00:00Z");

function makeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: "txn-1",
    companyId: "company-1",
    visitId: null,
    amount: 10000,
    feePercent: 250,
    feeAmount: 250,
    status: "PENDING",
    paidAt: null,
    createdAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDefaultFeePercent.mockResolvedValue(250);
});

describe("computeFeeAmount", () => {
  it("computes the fee from basis points, rounded to the cent", () => {
    expect(computeFeeAmount(10000, 250)).toBe(250); // $100.00 @ 2.5%
    expect(computeFeeAmount(8333, 250)).toBe(208); // rounds half up
    expect(computeFeeAmount(0, 250)).toBe(0);
    expect(computeFeeAmount(10000, 0)).toBe(0);
  });
});

describe("recordTransaction", () => {
  it("records a PENDING transaction with the auto-applied platform fee", async () => {
    prismaMock.paymentTransaction.create.mockResolvedValue(makeTransaction());

    const txn = await recordTransaction({ companyId: "company-1", amount: 10000 });

    expect(mockGetDefaultFeePercent).toHaveBeenCalled();
    expect(prismaMock.paymentTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        amount: 10000,
        feePercent: 250,
        feeAmount: 250,
      }),
    });
    expect(txn.status).toBe("PENDING");
  });

  it("attaches a visitId when provided", async () => {
    prismaMock.paymentTransaction.create.mockResolvedValue(
      makeTransaction({ visitId: "visit-1" }),
    );

    await recordTransaction({ companyId: "company-1", amount: 5000, visitId: "visit-1" });

    expect(prismaMock.paymentTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ visitId: "visit-1" }),
    });
  });

  it("rejects a non-positive amount", async () => {
    await expect(
      recordTransaction({ companyId: "company-1", amount: 0 }),
    ).rejects.toThrow(/positive/);
  });
});

describe("markTransactionPaid", () => {
  it("marks a transaction paid with a timestamp", async () => {
    prismaMock.paymentTransaction.findUnique.mockResolvedValue(makeTransaction());
    prismaMock.paymentTransaction.update.mockResolvedValue(
      makeTransaction({ status: "PAID", paidAt: now }),
    );

    const txn = await markTransactionPaid("txn-1", "company-1");

    expect(txn.status).toBe("PAID");
    expect(prismaMock.paymentTransaction.update).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: { status: "PAID", paidAt: expect.any(Date) },
    });
  });

  it("refuses to mark another company's transaction paid", async () => {
    prismaMock.paymentTransaction.findUnique.mockResolvedValue(
      makeTransaction({ companyId: "company-2" }),
    );

    await expect(markTransactionPaid("txn-1", "company-1")).rejects.toThrow(/not found/);
    expect(prismaMock.paymentTransaction.update).not.toHaveBeenCalled();
  });
});

describe("getCompanyTransactions", () => {
  it("lists a company's transactions newest first, limited", async () => {
    prismaMock.paymentTransaction.findMany.mockResolvedValue([makeTransaction()]);

    const rows = await getCompanyTransactions("company-1", 10);

    expect(prismaMock.paymentTransaction.findMany).toHaveBeenCalledWith({
      where: { companyId: "company-1" },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    expect(rows).toHaveLength(1);
  });
});

describe("simulateTransaction", () => {
  it("records and immediately marks paid a simulated charge", async () => {
    prismaMock.paymentTransaction.create.mockResolvedValue(makeTransaction());
    prismaMock.paymentTransaction.findUnique.mockResolvedValue(makeTransaction());
    prismaMock.paymentTransaction.update.mockResolvedValue(
      makeTransaction({ status: "PAID", paidAt: now }),
    );

    const txn = await simulateTransaction("company-1", 10000);

    expect(txn.status).toBe("PAID");
    expect(txn.feeAmount).toBe(250);
  });
});
