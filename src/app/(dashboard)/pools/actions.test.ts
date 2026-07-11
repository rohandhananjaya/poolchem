import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireTech: vi.fn(),
}));
vi.mock("@/lib/db/pools", () => ({
  createPool: vi.fn(),
  updatePool: vi.fn(),
  deletePool: vi.fn(),
  getPoolById: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { requireTech } = await import("@/lib/auth");
const { createPool, updatePool, deletePool, getPoolById } =
  await import("@/lib/db/pools");
const { revalidatePath } = await import("next/cache");
const {
  createPoolAction,
  updatePoolAction,
  deletePoolAction,
} = await import("./actions");

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

describe("createPoolAction", () => {
  it("creates a pool and returns ok", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);

    const result = await createPoolAction(
      { ok: false },
      formData({ name: "New Pool", volume: "10000" }),
    );

    expect(result).toEqual({ ok: true });
    expect(createPool).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Pool", volume: 10000 }),
      "company-1",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/pools");
  });

  it("returns error when name is empty", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);

    const result = await createPoolAction(
      { ok: false },
      formData({ name: "", volume: "10000" }),
    );

    expect(result).toEqual({ ok: false, error: "Pool name is required." });
  });

  it("returns error when volume is invalid", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);

    const result = await createPoolAction(
      { ok: false },
      formData({ name: "Pool", volume: "0" }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Volume must be a positive number.",
    });
  });

  it("returns error when user has no company", async () => {
    vi.mocked(requireTech).mockResolvedValue({
      ...mockUser,
      companyId: null,
    } as never);

    const result = await createPoolAction(
      { ok: false },
      formData({ name: "Pool", volume: "10000" }),
    );

    expect(result).toEqual({ ok: false, error: "No company affiliation." });
  });
});

describe("updatePoolAction", () => {
  it("updates a pool and returns ok", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);

    const result = await updatePoolAction(
      { ok: false },
      formData({
        poolId: "pool-1",
        name: "Updated",
        volume: "20000",
      }),
    );

    expect(result).toEqual({ ok: true });
    expect(updatePool).toHaveBeenCalledWith(
      "pool-1",
      expect.objectContaining({ name: "Updated" }),
      "company-1",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/pools");
  });

  it("returns error when poolId is missing", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);

    const result = await updatePoolAction(
      { ok: false },
      formData({ name: "Updated", volume: "20000" }),
    );

    expect(result).toEqual({ ok: false, error: "Pool ID is required." });
  });
});

describe("deletePoolAction", () => {
  it("deletes a pool after confirming the name", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(getPoolById).mockResolvedValue({
      id: "pool-1",
      name: "Pool to Delete",
    } as never);

    const result = await deletePoolAction(
      { ok: false },
      formData({ poolId: "pool-1", confirmName: "Pool to Delete" }),
    );

    expect(result).toEqual({ ok: true });
    expect(deletePool).toHaveBeenCalledWith("pool-1", "company-1");
    expect(revalidatePath).toHaveBeenCalledWith("/pools");
  });

  it("returns error when name does not match", async () => {
    vi.mocked(requireTech).mockResolvedValue(mockUser as never);
    vi.mocked(getPoolById).mockResolvedValue({
      id: "pool-1",
      name: "Pool to Delete",
    } as never);

    const result = await deletePoolAction(
      { ok: false },
      formData({ poolId: "pool-1", confirmName: "Wrong Name" }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Pool name does not match.",
    });
  });
});
