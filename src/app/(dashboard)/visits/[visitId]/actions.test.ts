import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireTech: vi.fn(),
}));
vi.mock("@/lib/db/visits", () => ({
  assertVisitAccess: vi.fn().mockResolvedValue("DRAFT"),
  saveDraftVisit: vi.fn(),
  completeVisit: vi.fn(),
  claimReportNotification: vi.fn().mockResolvedValue(true),
  releaseReportNotification: vi.fn(),
  startVisit: vi.fn(),
  updateVisitStatus: vi.fn(),
  cancelVisit: vi.fn(),
}));
vi.mock("@/lib/email/notify", () => ({
  notifyVisitCancelled: vi.fn(),
  notifyReportAvailable: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
const { saveDraftVisit, completeVisit, claimReportNotification, releaseReportNotification, startVisit, updateVisitStatus, cancelVisit, assertVisitAccess } = await import("@/lib/db/visits");
const { requireTech } = await import("@/lib/auth");
const emailNotify = await import("@/lib/email/notify");
const { revalidatePath } = await import("next/cache");
const { saveDraftAction, completeVisitAction, startVisitAction, updateVisitStatusAction, cancelVisitAction } = await import("./actions");

const mockUser = { id: "user-1", companyId: "company-1", role: "TECH" };
const visitId = "visit-1";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(claimReportNotification).mockResolvedValue(true);
  vi.mocked(emailNotify.notifyReportAvailable).mockResolvedValue({ ok: true });
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
      { clientMutationId: undefined, expectedVersion: undefined },
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
      { clientMutationId: "mut-1", expectedVersion: undefined },
    );
  });

  it("forwards expectedVersion and returns the fresh version", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(saveDraftVisit).mockResolvedValue({
      visit: { version: 4 },
      applied: true,
    } as never);

    const result = await saveDraftAction(visitId, {
      readings: { ph: 7.5 },
      chemicals: [],
      notes: "",
      expectedVersion: 3,
    });

    expect(saveDraftVisit).toHaveBeenCalledWith(
      visitId,
      expect.any(Object),
      [],
      null,
      null,
      { clientMutationId: undefined, expectedVersion: 3 },
    );
    expect(result).toEqual({ version: 4 });
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireTech).mockRejectedValue(new Error("Auth required"));

    await expect(
      saveDraftAction(visitId, {} as never),
    ).rejects.toThrow("Auth required");
  });

  it("normalizes missing readings to 0 before calling saveDraftVisit", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);

    await saveDraftAction(visitId, {
      readings: { ph: 7.5 },
      chemicals: [],
      notes: "",
    });

    expect(saveDraftVisit).toHaveBeenCalledWith(
      visitId,
      {
        ph: 7.5,
        freeChlorine: 0,
        totalAlkalinity: 0,
        calciumHardness: 0,
        cyanuricAcid: 0,
        temperature: 0,
      },
      [],
      null,
      null,
      { clientMutationId: undefined, expectedVersion: undefined },
    );
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
      { clientMutationId: undefined, expectedVersion: undefined },
    );
    expect(emailNotify.notifyReportAvailable).not.toHaveBeenCalled();
    expect(claimReportNotification).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith(`/visits/${visitId}`);
  });

  it("auto-sends the report to the pool's homeowner when one is set", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(completeVisit).mockResolvedValue({
      visit: {
        pool: { homeownerEmail: "owner@example.com" },
        reportNotifiedAt: null,
      },
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

    expect(claimReportNotification).toHaveBeenCalledWith(visitId, "company-1");
    expect(emailNotify.notifyReportAvailable).toHaveBeenCalledWith({
      companyId: "company-1",
      visitId,
      to: "owner@example.com",
    });
    expect(releaseReportNotification).not.toHaveBeenCalled();
  });

  it("skips the report email when the stamp is already set, even on a fresh write", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(completeVisit).mockResolvedValue({
      visit: {
        pool: { homeownerEmail: "owner@example.com" },
        reportNotifiedAt: new Date("2026-08-01T12:00:00"),
      },
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

    expect(claimReportNotification).not.toHaveBeenCalled();
    expect(emailNotify.notifyReportAvailable).not.toHaveBeenCalled();
  });

  it("sends the report on an idempotent replay whose stamp is still null", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(completeVisit).mockResolvedValue({
      visit: {
        pool: { homeownerEmail: "owner@example.com" },
        reportNotifiedAt: null,
      },
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

    expect(claimReportNotification).toHaveBeenCalledWith(visitId, "company-1");
    expect(emailNotify.notifyReportAvailable).toHaveBeenCalled();
  });

  it("skips the report email on a replay whose stamp is already set", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(completeVisit).mockResolvedValue({
      visit: {
        pool: { homeownerEmail: "owner@example.com" },
        reportNotifiedAt: new Date("2026-08-01T12:00:00"),
      },
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

    expect(claimReportNotification).not.toHaveBeenCalled();
    expect(emailNotify.notifyReportAvailable).not.toHaveBeenCalled();
  });

  it("skips sending when a concurrent retry wins the claim", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(completeVisit).mockResolvedValue({
      visit: {
        pool: { homeownerEmail: "owner@example.com" },
        reportNotifiedAt: null,
      },
      applied: true,
    } as never);
    vi.mocked(claimReportNotification).mockResolvedValue(false);

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
    expect(releaseReportNotification).not.toHaveBeenCalled();
  });

  it("releases the claim when the email send fails", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(completeVisit).mockResolvedValue({
      visit: {
        pool: { homeownerEmail: "owner@example.com" },
        reportNotifiedAt: null,
      },
      applied: true,
    } as never);
    vi.mocked(emailNotify.notifyReportAvailable).mockResolvedValue({
      ok: false,
      error: "Resend down",
    });

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

    expect(emailNotify.notifyReportAvailable).toHaveBeenCalled();
    expect(releaseReportNotification).toHaveBeenCalledWith(visitId, "company-1");
  });

  it("releases the claim when the email send throws", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(completeVisit).mockResolvedValue({
      visit: {
        pool: { homeownerEmail: "owner@example.com" },
        reportNotifiedAt: null,
      },
      applied: true,
    } as never);
    vi.mocked(emailNotify.notifyReportAvailable).mockRejectedValue(
      new Error("DB down"),
    );

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

    expect(emailNotify.notifyReportAvailable).toHaveBeenCalled();
    expect(releaseReportNotification).toHaveBeenCalledWith(visitId, "company-1");
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
      { clientMutationId: "mut-2", expectedVersion: undefined },
    );
  });

  it("forwards expectedVersion and returns the fresh version", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(completeVisit).mockResolvedValue({
      visit: { version: 9, pool: { homeownerEmail: null } },
      applied: true,
    } as never);

    const result = await completeVisitAction(visitId, {
      readings: { ph: 7.5 },
      chemicals: [],
      notes: "",
      expectedVersion: 8,
    });

    expect(completeVisit).toHaveBeenCalledWith(
      visitId,
      expect.any(Object),
      [],
      null,
      null,
      { clientMutationId: undefined, expectedVersion: 8 },
    );
    expect(result).toEqual({ version: 9 });
  });

  it("propagates a version-conflict rejection from completeVisit", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(completeVisit).mockRejectedValue(
      new Error(
        "This visit was updated on another device. Refresh and re-apply your changes.",
      ),
    );

    await expect(
      completeVisitAction(visitId, {
        readings: { ph: 7.5 },
        chemicals: [],
        notes: "",
        expectedVersion: 2,
      }),
    ).rejects.toThrow("updated on another device");
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
