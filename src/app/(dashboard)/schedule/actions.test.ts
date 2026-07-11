import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireTech: vi.fn(),
}));
vi.mock("@/lib/db/visits", () => ({
  createVisit: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { requireTech } = await import("@/lib/auth");
const { createVisit } = await import("@/lib/db/visits");
const { revalidatePath } = await import("next/cache");
const { scheduleVisitAction } = await import("./actions");

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
