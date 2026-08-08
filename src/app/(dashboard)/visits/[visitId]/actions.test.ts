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
}));
vi.mock("@/lib/email/notify", () => ({
  notifyVisitCancelled: vi.fn(),
  notifyReportAvailable: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
const { saveDraftVisit, completeVisit, startVisit, updateVisitStatus, cancelVisit, assertVisitAccess } = await import("@/lib/db/visits");
const { requireTech } = await import("@/lib/auth");
const emailNotify = await import("@/lib/email/notify");
const { revalidatePath } = await import("next/cache");
const { saveDraftAction, completeVisitAction, startVisitAction, updateVisitStatusAction, cancelVisitAction } = await import("./actions");

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
      { clientMutationId: undefined },
    );
    expect(revalidatePath).toHaveBeenCalledWith(`/visits/${visitId}`);
  });

  it("passes clientMutationId through to saveDraftVisit when provided", async () => {
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
      clientMutationId: "mut-1",
    });

    expect(saveDraftVisit).toHaveBeenCalledWith(
      visitId,
      expect.any(Object),
      [],
      "test",
      null,
      { clientMutationId: "mut-1" },
    );
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
      applied: true,
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
      { clientMutationId: undefined },
    );
    expect(emailNotify.notifyReportAvailable).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith(`/visits/${visitId}`);
  });

  it("auto-sends the report to the pool's homeowner when one is set", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(completeVisit).mockResolvedValue({
      visit: { pool: { homeownerEmail: "owner@example.com" } },
      applied: true,
      reportAlreadyNotified: false,
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

  it("skips the report email when the report was already notified, even on a fresh write", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(completeVisit).mockResolvedValue({
      visit: { pool: { homeownerEmail: "owner@example.com" } },
      applied: true,
      reportAlreadyNotified: true,
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

    expect(emailNotify.notifyReportAvailable).not.toHaveBeenCalled();
  });

  it("skips the report email when completeVisit reports an idempotent replay", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(completeVisit).mockResolvedValue({
      visit: { pool: { homeownerEmail: "owner@example.com" } },
      applied: false,
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

    expect(emailNotify.notifyReportAvailable).not.toHaveBeenCalled();
  });

  it("passes clientMutationId through to completeVisit when provided", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(completeVisit).mockResolvedValue({
      visit: { pool: { homeownerEmail: null } },
      applied: true,
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
      clientMutationId: "mut-2",
    });

    expect(completeVisit).toHaveBeenCalledWith(
      visitId,
      expect.any(Object),
      [],
      null,
      null,
      { clientMutationId: "mut-2" },
    );
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
