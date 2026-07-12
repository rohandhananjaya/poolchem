import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireTech: vi.fn(),
}));
vi.mock("@/lib/db/visits", () => ({
  createVisit: vi.fn(),
  cancelVisit: vi.fn(),
  updateVisit: vi.fn(),
  assertVisitAccess: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { requireTech } = await import("@/lib/auth");
const { createVisit, cancelVisit, updateVisit, assertVisitAccess } = await import("@/lib/db/visits");
const { revalidatePath } = await import("next/cache");
const { scheduleVisitAction, cancelVisitAction, updateVisitAction } = await import("./actions");

const mockUser = { id: "user-1", companyId: "company-1", role: "TECH" };

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.append(key, value);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("scheduleVisitAction", () => {
  it("schedules a visit with parsed date and returns ok", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);

    const result = await scheduleVisitAction(
      { ok: false },
      formData({ poolId: "pool-1", date: "2026-07-15" }),
    );

    expect(result).toEqual({ ok: true });
    expect(createVisit).toHaveBeenCalledWith(
      "pool-1",
      "user-1",
      "company-1",
      expect.any(Date),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/schedule");
  });

  it("returns error when poolId is missing", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);

    const result = await scheduleVisitAction(
      { ok: false },
      formData({ date: "2026-07-15" }),
    );

    expect(result).toEqual({ ok: false, error: "Please choose a pool." });
  });

  it("returns error when date is invalid", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);

    const result = await scheduleVisitAction(
      { ok: false },
      formData({ poolId: "pool-1", date: "not-a-date" }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Please choose a valid date.",
    });
  });

  it("returns error when user has no company", async () => {
    vi.mocked(requireTech).mockResolvedValue({
      ...mockUser,
      companyId: null,
    } as never);

    const result = await scheduleVisitAction(
      { ok: false },
      formData({ poolId: "pool-1", date: "2026-07-15" }),
    );

    expect(result).toEqual({
      ok: false,
      error: "No company affiliation.",
    });
  });
});

describe("cancelVisitAction", () => {
  it("cancels a visit and revalidates", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(assertVisitAccess).mockResolvedValue("DRAFT" as never);
    vi.mocked(cancelVisit).mockResolvedValue({ id: "visit-1", status: "CANCELLED" } as never);

    const result = await cancelVisitAction(
      { ok: false },
      formData({ visitId: "visit-1", reason: "Client cancelled" }),
    );

    expect(result).toEqual({ ok: true });
    expect(assertVisitAccess).toHaveBeenCalledWith("visit-1", "company-1", "user-1");
    expect(cancelVisit).toHaveBeenCalledWith("visit-1", "company-1", "Client cancelled");
    expect(revalidatePath).toHaveBeenCalledWith("/schedule");
  });

  it("returns error when visitId is missing", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);

    const result = await cancelVisitAction(
      { ok: false },
      formData({ reason: "reason" }),
    );

    expect(result).toEqual({ ok: false, error: "Visit ID is required." });
  });

  it("returns error when reason is missing", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);

    const result = await cancelVisitAction(
      { ok: false },
      formData({ visitId: "visit-1", reason: "" }),
    );

    expect(result).toEqual({ ok: false, error: "A cancellation reason is required." });
  });

  it("returns error when visit not found", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(assertVisitAccess).mockResolvedValue("DRAFT" as never);
    vi.mocked(cancelVisit).mockResolvedValue(null);

    const result = await cancelVisitAction(
      { ok: false },
      formData({ visitId: "visit-1", reason: "No reason" }),
    );

    expect(result).toEqual({ ok: false, error: "Visit not found." });
  });
});

describe("updateVisitAction", () => {
  it("updates visit date and revalidates", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(updateVisit).mockResolvedValue({ id: "visit-1" } as never);

    const result = await updateVisitAction(
      { ok: false },
      formData({ visitId: "visit-1", date: "2026-07-20" }),
    );

    expect(result).toEqual({ ok: true });
    expect(updateVisit).toHaveBeenCalledWith("visit-1", "company-1", {
      scheduledAt: expect.any(Date),
      techId: "user-1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/schedule");
  });

  it("returns error when visitId is missing", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);

    const result = await updateVisitAction(
      { ok: false },
      formData({ date: "2026-07-20" }),
    );

    expect(result).toEqual({ ok: false, error: "Visit ID is required." });
  });

  it("returns error when date format is invalid", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);

    const result = await updateVisitAction(
      { ok: false },
      formData({ visitId: "visit-1", date: "bad-date" }),
    );

    expect(result).toEqual({ ok: false, error: "Please choose a valid date." });
  });

  it("returns error when visit not found", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(updateVisit).mockResolvedValue(null);

    const result = await updateVisitAction(
      { ok: false },
      formData({ visitId: "visit-1" }),
    );

    expect(result).toEqual({ ok: false, error: "Visit not found." });
  });
});
