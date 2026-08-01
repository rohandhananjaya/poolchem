import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireOwner: vi.fn(),
}));
vi.mock("@/lib/db/pools", () => ({
  createPool: vi.fn(),
  updatePool: vi.fn(),
  deletePool: vi.fn(),
  getPoolById: vi.fn(),
  getPoolCount: vi.fn(),
  createPoolsBulk: vi.fn(),
  getAllPoolsForExport: vi.fn(),
}));
vi.mock("@/lib/db/packages", () => ({
  getCompanyPackage: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { requireOwner } = await import("@/lib/auth");
const {
  createPool,
  updatePool,
  deletePool,
  getPoolById,
  getPoolCount,
  createPoolsBulk,
  getAllPoolsForExport,
} = await import("@/lib/db/pools");
const { getCompanyPackage } = await import("@/lib/db/packages");
const { revalidatePath } = await import("next/cache");
const {
  createPoolAction,
  updatePoolAction,
  deletePoolAction,
  importPoolsAction,
  exportPoolsAction,
} = await import("./actions");

const mockUser = { id: "user-1", companyId: "company-1", role: "TECH" };
const mockCompanyPackage = {
  package: null,
  status: "TRIAL",
  trialStart: null,
  trialEnd: null,
  paidAt: null,
};
const nonTrialCompanyPackage = (maxPools: number) => ({
  package: {
    id: "pkg-1",
    slug: "pro",
    name: "Pro",
    price: 3900,
    sortOrder: 0,
    features: {
      max_pools: maxPools,
      health_scoring: "advanced+lsi" as const,
      chemical_recs: true,
      service_reports: true,
      qr_code: true,
      scheduling: true,
      max_techs: -1,
      priority_support: true,
      custom_branding: true,
      api_access: true,
      csv_import: true,
    },
  },
  status: "ACTIVE",
  trialStart: null,
  trialEnd: null,
  paidAt: new Date(),
});

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
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
    vi.mocked(getCompanyPackage).mockResolvedValue(mockCompanyPackage as never);
    vi.mocked(getPoolCount).mockResolvedValue(0);

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
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);

    const result = await createPoolAction(
      { ok: false },
      formData({ name: "", volume: "10000" }),
    );

    expect(result).toEqual({ ok: false, error: "Pool name is required." });
  });

  it("returns error when volume is invalid", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);

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
    vi.mocked(requireOwner).mockResolvedValue({
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
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);

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
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);

    const result = await updatePoolAction(
      { ok: false },
      formData({ name: "Updated", volume: "20000" }),
    );

    expect(result).toEqual({ ok: false, error: "Pool ID is required." });
  });
});

describe("deletePoolAction", () => {
  it("deletes a pool after confirming the name", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
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
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
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

describe("importPoolsAction", () => {
  const validRow = { name: "Pool", volume: "10000" };

  it("returns error when user has no company", async () => {
    vi.mocked(requireOwner).mockResolvedValue({
      ...mockUser,
      companyId: null,
    } as never);

    const result = await importPoolsAction(["name", "volume"], [validRow]);

    expect(result).toEqual({
      ok: false,
      error: "No company affiliation.",
      imported: 0,
      skipped: [],
    });
  });

  it("rejects when the plan does not include csv_import", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
    vi.mocked(getPoolCount).mockResolvedValue(0);
    const gated = nonTrialCompanyPackage(-1);
    gated.package.features.csv_import = false;
    vi.mocked(getCompanyPackage).mockResolvedValue(gated as never);

    const result = await importPoolsAction(["name", "volume"], [validRow]);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not available on your plan/);
    expect(createPoolsBulk).not.toHaveBeenCalled();
  });

  it("rejects the whole file when a required column is missing", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
    vi.mocked(getCompanyPackage).mockResolvedValue(mockCompanyPackage as never);
    vi.mocked(getPoolCount).mockResolvedValue(0);

    const result = await importPoolsAction(["name"], [{ name: "Pool" }]);

    expect(result).toEqual({
      ok: false,
      error: "CSV is missing required column(s): volume.",
      imported: 0,
      skipped: [],
    });
  });

  it("rejects an empty file", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
    vi.mocked(getCompanyPackage).mockResolvedValue(mockCompanyPackage as never);
    vi.mocked(getPoolCount).mockResolvedValue(0);

    const result = await importPoolsAction(["name", "volume"], []);

    expect(result).toEqual({
      ok: false,
      error: "No data rows found in the CSV.",
      imported: 0,
      skipped: [],
    });
  });

  it("rejects a file over the row cap", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
    vi.mocked(getCompanyPackage).mockResolvedValue(mockCompanyPackage as never);
    vi.mocked(getPoolCount).mockResolvedValue(0);

    const rows = Array.from({ length: 501 }, (_, i) => ({ name: `Pool ${i}`, volume: "1000" }));
    const result = await importPoolsAction(["name", "volume"], rows);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/maximum per import is 500/);
  });

  it("imports valid rows and reports skipped rows with reasons", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
    vi.mocked(getCompanyPackage).mockResolvedValue(mockCompanyPackage as never);
    vi.mocked(getPoolCount).mockResolvedValue(0);
    vi.mocked(createPoolsBulk).mockResolvedValue({
      created: [{ id: "pool-1" } as never],
      failed: [],
    });

    const result = await importPoolsAction(
      ["name", "volume"],
      [validRow, { name: "", volume: "10000" }],
    );

    expect(createPoolsBulk).toHaveBeenCalledWith(
      [expect.objectContaining({ name: "Pool", volume: 10000 })],
      "company-1",
    );
    expect(result).toEqual({
      ok: true,
      imported: 1,
      skipped: [{ row: 3, reason: "name is required" }],
    });
    expect(revalidatePath).toHaveBeenCalledWith("/pools");
  });

  it("does not revalidate when nothing was created", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
    vi.mocked(getCompanyPackage).mockResolvedValue(mockCompanyPackage as never);
    vi.mocked(getPoolCount).mockResolvedValue(0);
    vi.mocked(createPoolsBulk).mockResolvedValue({ created: [], failed: [] });

    await importPoolsAction(["name", "volume"], [{ name: "", volume: "10000" }]);

    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("skips rows beyond the plan's remaining pool capacity", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
    vi.mocked(getCompanyPackage).mockResolvedValue(nonTrialCompanyPackage(1) as never);
    vi.mocked(getPoolCount).mockResolvedValue(0);
    vi.mocked(createPoolsBulk).mockResolvedValue({
      created: [{ id: "pool-1" } as never],
      failed: [],
    });

    const result = await importPoolsAction(
      ["name", "volume"],
      [validRow, { name: "Pool 2", volume: "20000" }],
    );

    expect(createPoolsBulk).toHaveBeenCalledWith(
      [expect.objectContaining({ name: "Pool" })],
      "company-1",
    );
    expect(result.imported).toBe(1);
    expect(result.skipped).toEqual([
      { row: 3, reason: "Skipped — plan limit of 1 pools reached." },
    ]);
  });
});

describe("exportPoolsAction", () => {
  it("returns error when user has no company", async () => {
    vi.mocked(requireOwner).mockResolvedValue({
      ...mockUser,
      companyId: null,
    } as never);

    const result = await exportPoolsAction();

    expect(result).toEqual({ ok: false, error: "No company affiliation." });
  });

  it("rejects when the plan does not include csv_import", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
    const gated = nonTrialCompanyPackage(-1);
    gated.package.features.csv_import = false;
    vi.mocked(getCompanyPackage).mockResolvedValue(gated as never);

    const result = await exportPoolsAction();

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not available on your plan/);
    expect(getAllPoolsForExport).not.toHaveBeenCalled();
  });

  it("returns csv-ready pool rows", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
    vi.mocked(getCompanyPackage).mockResolvedValue(mockCompanyPackage as never);
    vi.mocked(getAllPoolsForExport).mockResolvedValue([
      {
        id: "pool-1",
        name: "Pool",
        volume: 10000,
        address: null,
        image: null,
        qrCode: "POOL-abc",
        publicToken: "tok",
        homeownerEmail: null,
        homeownerPhone: null,
        notes: null,
        companyId: "company-1",
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      } as never,
    ]);

    const result = await exportPoolsAction();

    expect(result.ok).toBe(true);
    expect(result.data).toEqual([
      expect.objectContaining({ name: "Pool", volume: 10000 }),
    ]);
  });
});
