import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireTech: vi.fn(),
}));
vi.mock("@/lib/db/visits", () => ({
  saveDraftVisit: vi.fn(),
  completeVisit: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

const { saveDraftVisit, completeVisit } = await import("@/lib/db/visits");
const { requireTech } = await import("@/lib/auth");
const { revalidatePath } = await import("next/cache");
const { redirect } = await import("next/navigation");
const { saveDraftAction, completeVisitAction } = await import("./actions");

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
  it("calls completeVisit, revalidates and redirects", async () => {
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
    expect(redirect).toHaveBeenCalledWith(`/visits/${visitId}`);
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireTech).mockRejectedValue(new Error("Auth required"));

    await expect(
      completeVisitAction(visitId, {} as never),
    ).rejects.toThrow("Auth required");
  });
});
