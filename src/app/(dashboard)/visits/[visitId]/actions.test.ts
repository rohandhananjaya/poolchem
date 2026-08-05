import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireTech: vi.fn(),
}));
vi.mock("@/lib/db/visits", () => ({
  assertVisitAccess: vi.fn().mockResolvedValue("DRAFT"),
  saveDraftVisit: vi.fn(),
  completeVisit: vi.fn(),
  startVisit: vi.fn(),
  updateVisitStatus: vi.fn(),
  cancelVisit: vi.fn(),
  getVisitById: vi.fn(),
}));
vi.mock("@/lib/db/company", () => ({
  getCompanyById: vi.fn(),
}));
vi.mock("@/lib/db/visit-payments", () => ({
  recordVisitPayment: vi.fn(),
}));
vi.mock("@/lib/payment/terminal", () => ({
  getCardPresentProvider: vi.fn(),
}));
vi.mock("@/lib/email/notify", () => ({
  notifyVisitCancelled: vi.fn(),
  notifyReportAvailable: vi.fn(),
  notifyCustomerReceipt: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
const { saveDraftVisit, completeVisit, startVisit, updateVisitStatus, cancelVisit, assertVisitAccess, getVisitById } = await import("@/lib/db/visits");
const { requireTech } = await import("@/lib/auth");
const { getCompanyById } = await import("@/lib/db/company");
const { recordVisitPayment } = await import("@/lib/db/visit-payments");
const { getCardPresentProvider } = await import("@/lib/payment/terminal");
const emailNotify = await import("@/lib/email/notify");
const { revalidatePath } = await import("next/cache");
const { saveDraftAction, completeVisitAction, startVisitAction, updateVisitStatusAction, cancelVisitAction, chargeVisitAction } = await import("./actions");

const mockUser = { id: "user-1", companyId: "company-1", role: "TECH" };
const visitId = "visit-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveDraftAction", () => {
  it("calls saveDraftVisit and revalidates", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);

    await saveDraftAction(visitId, {
      readings: {
        ph: 7.5,
        freeChlorine: 2,
        totalAlkalinity: 100,
        calciumHardness: 300,
        cyanuricAcid: 40,
        temperature: 80,
      },
      chemicals: [],
      notes: "test",
    });

    expect(saveDraftVisit).toHaveBeenCalledWith(
      visitId,
      expect.any(Object),
      [],
      "test",
      null,
    );
    expect(revalidatePath).toHaveBeenCalledWith(`/visits/${visitId}`);
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireTech).mockRejectedValue(new Error("Auth required"));

    await expect(
      saveDraftAction(visitId, {} as never),
    ).rejects.toThrow("Auth required");
  });
});

describe("completeVisitAction", () => {
  it("calls completeVisit and revalidates", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(completeVisit).mockResolvedValue({
      visit: { pool: { homeownerEmail: null } },
    } as never);

    await completeVisitAction(visitId, {
      readings: {
        ph: 7.5,
        freeChlorine: 2,
        totalAlkalinity: 100,
        calciumHardness: 300,
        cyanuricAcid: 40,
        temperature: 80,
      },
      chemicals: [],
      notes: "",
    });

    expect(completeVisit).toHaveBeenCalledWith(
      visitId,
      expect.any(Object),
      [],
      null,
      null,
    );
    expect(emailNotify.notifyReportAvailable).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith(`/visits/${visitId}`);
  });

  it("auto-sends the report to the pool's homeowner when one is set", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(completeVisit).mockResolvedValue({
      visit: { pool: { homeownerEmail: "owner@example.com" } },
    } as never);

    await completeVisitAction(visitId, {
      readings: {
        ph: 7.5,
        freeChlorine: 2,
        totalAlkalinity: 100,
        calciumHardness: 300,
        cyanuricAcid: 40,
        temperature: 80,
      },
      chemicals: [],
      notes: "",
    });

    expect(emailNotify.notifyReportAvailable).toHaveBeenCalledWith({
      companyId: "company-1",
      visitId,
      to: "owner@example.com",
    });
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireTech).mockRejectedValue(new Error("Auth required"));

    await expect(
      completeVisitAction(visitId, {} as never),
    ).rejects.toThrow("Auth required");
  });
});

describe("startVisitAction", () => {
  it("starts a visit and revalidates", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(startVisit).mockResolvedValue({ id: visitId, status: "IN_PROGRESS" } as never);

    await startVisitAction(visitId);

    expect(startVisit).toHaveBeenCalledWith(visitId, "company-1", "user-1");
    expect(revalidatePath).toHaveBeenCalledWith(`/visits/${visitId}`);
  });

  it("throws when visit not found or already started", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(startVisit).mockResolvedValue(null);

    await expect(startVisitAction(visitId)).rejects.toThrow("Visit not found or already started.");
  });
});

describe("updateVisitStatusAction", () => {
  it("updates visit status and revalidates", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(assertVisitAccess).mockResolvedValue("IN_PROGRESS" as never);
    vi.mocked(updateVisitStatus).mockResolvedValue({ id: visitId, status: "COMPLETED" } as never);

    await updateVisitStatusAction(visitId, "COMPLETED" as never);

    expect(assertVisitAccess).toHaveBeenCalledWith(visitId, "company-1", "user-1");
    expect(updateVisitStatus).toHaveBeenCalledWith(visitId, "company-1", "COMPLETED");
    expect(revalidatePath).toHaveBeenCalledWith(`/visits/${visitId}`);
  });

  it("throws when visit not found", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(assertVisitAccess).mockResolvedValue("IN_PROGRESS" as never);
    vi.mocked(updateVisitStatus).mockResolvedValue(null);

    await expect(
      updateVisitStatusAction(visitId, "COMPLETED" as never),
    ).rejects.toThrow("Visit not found.");
  });
});

describe("cancelVisitAction", () => {
  it("cancels a visit and revalidates", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(assertVisitAccess).mockResolvedValue("DRAFT" as never);
    vi.mocked(cancelVisit).mockResolvedValue({ id: visitId, status: "CANCELLED" } as never);

    await cancelVisitAction(visitId, "Client request");

    expect(assertVisitAccess).toHaveBeenCalledWith(visitId, "company-1", "user-1");
    expect(cancelVisit).toHaveBeenCalledWith(visitId, "company-1", "Client request");
    expect(emailNotify.notifyVisitCancelled).toHaveBeenCalledWith({
      companyId: "company-1",
      visitId,
      reason: "Client request",
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/visits/${visitId}`);
  });

  it("throws when visit not found", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(assertVisitAccess).mockResolvedValue("DRAFT" as never);
    vi.mocked(cancelVisit).mockResolvedValue(null);

    await expect(cancelVisitAction(visitId, "reason")).rejects.toThrow("Visit not found.");
  });
});

describe("chargeVisitAction", () => {
  const mockCapture = vi.fn();
  const mockCompany = { id: "company-1", name: "Test Co", email: "billing@testco.com", stripeConnectAccountId: "acct_1" };

  beforeEach(() => {
    vi.mocked(getCardPresentProvider).mockReturnValue({
      captureCharge: mockCapture,
    } as never);
  });

  it("captures a charge, records the visit payment, emails a receipt, and revalidates", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(getVisitById).mockResolvedValue({
      id: visitId,
      paymentStatus: "UNPAID",
      pool: { name: "Backyard", homeownerEmail: "owner@example.com" },
    } as never);
    vi.mocked(getCompanyById).mockResolvedValue(mockCompany as never);
    mockCapture.mockResolvedValue({
      providerReference: "sim_123",
      captureMethod: "simulated",
    });
    vi.mocked(recordVisitPayment).mockResolvedValue({
      id: "txn-1",
      amount: 5000,
      feeAmount: 125,
    } as never);

    const result = await chargeVisitAction(visitId, 5000);

    expect(mockCapture).toHaveBeenCalledWith({
      amountCents: 5000,
      description: "Pool service — Backyard",
      connectedAccountId: "acct_1",
    });
    expect(recordVisitPayment).toHaveBeenCalledWith({
      companyId: "company-1",
      visitId,
      amount: 5000,
    });
    expect(emailNotify.notifyCustomerReceipt).toHaveBeenCalledWith({
      companyId: "company-1",
      visitId,
      to: "owner@example.com",
      amount: 50,
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/visits/${visitId}`);
    expect(result).toEqual({
      ok: true,
      transactionId: "txn-1",
      amount: 5000,
      feeAmount: 125,
      captureMethod: "simulated",
    });
  });

  it("skips the receipt when the pool has no homeowner email", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(getVisitById).mockResolvedValue({
      id: visitId,
      paymentStatus: "UNPAID",
      pool: { name: "Backyard", homeownerEmail: null },
    } as never);
    mockCapture.mockResolvedValue({
      providerReference: "sim_123",
      captureMethod: "simulated",
    });
    vi.mocked(recordVisitPayment).mockResolvedValue({
      id: "txn-1",
      amount: 2500,
      feeAmount: 63,
    } as never);

    await chargeVisitAction(visitId, 2500);

    expect(emailNotify.notifyCustomerReceipt).not.toHaveBeenCalled();
  });

  it("rejects charging an already-paid visit", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(getVisitById).mockResolvedValue({
      id: visitId,
      paymentStatus: "PAID",
      pool: { name: "Backyard", homeownerEmail: null },
    } as never);

    await expect(chargeVisitAction(visitId, 5000)).rejects.toThrow(
      "This visit is already paid.",
    );
    expect(mockCapture).not.toHaveBeenCalled();
    expect(recordVisitPayment).not.toHaveBeenCalled();
  });

  it("rejects a non-positive amount", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);

    await expect(chargeVisitAction(visitId, 0)).rejects.toThrow(
      "Charge amount must be a positive number of cents.",
    );
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireTech).mockRejectedValue(new Error("Auth required"));

    await expect(chargeVisitAction(visitId, 5000)).rejects.toThrow(
      "Auth required",
    );
  });
});
