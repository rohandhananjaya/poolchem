import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireActivePackage: vi.fn(),
}));
vi.mock("@/lib/db/pools", () => ({
  getPoolById: vi.fn(),
  getPoolByQR: vi.fn(),
}));
vi.mock("@/lib/db/visits", () => ({
  createVisit: vi.fn(),
}));

const { requireActivePackage } = await import("@/lib/auth");
const { getPoolById, getPoolByQR } = await import("@/lib/db/pools");
const { createVisit } = await import("@/lib/db/visits");
const { startVisitFromScan } = await import("./actions");

const mockUser = { id: "user-1", companyId: "company-1", role: "TECH" };
const mockPool = {
  id: "pool-1",
  name: "Test Pool",
  companyId: "company-1",
};
const mockVisit = { id: "visit-1", status: "DRAFT" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("startVisitFromScan", () => {
  it("resolves by QR code when pool belongs to the user's company", async () => {
    vi.mocked(requireActivePackage).mockResolvedValue(mockUser as never);
    vi.mocked(getPoolByQR).mockResolvedValue(mockPool as never);
    vi.mocked(createVisit).mockResolvedValue(mockVisit as never);

    const result = await startVisitFromScan("POOL-abc");

    expect(result).toEqual({ ok: true, visitId: "visit-1" });
    expect(getPoolByQR).toHaveBeenCalledWith("POOL-abc");
    expect(createVisit).toHaveBeenCalledWith(
      "pool-1",
      "user-1",
      "company-1",
    );
  });

  it("falls back to pool id when QR code belongs to another company", async () => {
    vi.mocked(requireActivePackage).mockResolvedValue(mockUser as never);
    vi.mocked(getPoolByQR).mockResolvedValue({
      ...mockPool,
      companyId: "other-company",
    } as never);
    vi.mocked(getPoolById).mockResolvedValue(mockPool as never);
    vi.mocked(createVisit).mockResolvedValue(mockVisit as never);

    const result = await startVisitFromScan("pool-1");

    expect(result).toEqual({ ok: true, visitId: "visit-1" });
    expect(getPoolById).toHaveBeenCalledWith("pool-1", "company-1");
  });

  it("returns not-found when no pool matches", async () => {
    vi.mocked(requireActivePackage).mockResolvedValue(mockUser as never);
    vi.mocked(getPoolByQR).mockResolvedValue(null);
    vi.mocked(getPoolById).mockResolvedValue(null);

    const result = await startVisitFromScan("unknown");

    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("returns not-found when the code is empty", async () => {
    vi.mocked(requireActivePackage).mockResolvedValue(mockUser as never);

    const result = await startVisitFromScan("  ");

    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("returns not-found when user has no company", async () => {
    vi.mocked(requireActivePackage).mockResolvedValue({
      ...mockUser,
      companyId: null,
    } as never);

    const result = await startVisitFromScan("POOL-abc");

    expect(result).toEqual({ ok: false, reason: "not-found" });
  });
});
