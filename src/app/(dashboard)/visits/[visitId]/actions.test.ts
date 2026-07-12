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
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
const { saveDraftVisit, completeVisit, startVisit, updateVisitStatus, cancelVisit, assertVisitAccess } = await import("@/lib/db/visits");
const { requireTech } = await import("@/lib/auth");
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
      notes: null,
    });

    expect(completeVisit).toHaveBeenCalledWith(
      visitId,
      expect.any(Object),
      [],
      null,
    );
    expect(revalidatePath).toHaveBeenCalledWith(`/visits/${visitId}`);
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
    expect(revalidatePath).toHaveBeenCalledWith(`/visits/${visitId}`);
  });

  it("throws when visit not found", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(assertVisitAccess).mockResolvedValue("DRAFT" as never);
    vi.mocked(cancelVisit).mockResolvedValue(null);

    await expect(cancelVisitAction(visitId, "reason")).rejects.toThrow("Visit not found.");
  });
});
