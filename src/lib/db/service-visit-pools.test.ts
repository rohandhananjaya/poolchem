import { describe, expect, it, beforeEach, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const {
  getServiceVisitPoolsByVisit,
  getPoolsByVisit,
  getVisitsByPool,
  assertPoolsBelongToCompany,
} = await import("@/lib/db/service-visit-pools");

const companyId = "company-1";
const visitId = "visit-1";
const poolId = "pool-1";

const mockPool = {
  id: poolId,
  name: "Backyard Pool",
  volume: 15_000,
  companyId,
  isActive: true,
  address: "456 Lake Rd",
  notes: null,
  qrCode: "POOL-abc",
  publicToken: "tok_abc",
  propertyId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockJoinRow = {
  id: "svp-1",
  serviceVisitId: visitId,
  poolId,
  companyId,
  createdAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getServiceVisitPoolsByVisit", () => {
  it("returns join rows with the pool attached for a same-company visit", async () => {
    prismaMock.serviceVisitPool.findMany.mockResolvedValue([
      { ...mockJoinRow, pool: mockPool },
    ]);

    const result = await getServiceVisitPoolsByVisit(visitId, companyId);

    expect(result).toHaveLength(1);
    expect(result[0].pool.id).toBe(poolId);
    expect(prismaMock.serviceVisitPool.findMany).toHaveBeenCalledWith({
      where: { serviceVisitId: visitId, companyId },
      include: { pool: true },
    });
  });

  it("returns an empty array for a cross-tenant visit id", async () => {
    prismaMock.serviceVisitPool.findMany.mockResolvedValue([]);
    const result = await getServiceVisitPoolsByVisit(visitId, "wrong-company");
    expect(result).toEqual([]);
  });
});

describe("getPoolsByVisit", () => {
  it("returns the pools served by a visit", async () => {
    prismaMock.serviceVisitPool.findMany.mockResolvedValue([
      { ...mockJoinRow, pool: mockPool },
    ]);

    const result = await getPoolsByVisit(visitId, companyId);

    expect(result).toEqual([mockPool]);
    expect(prismaMock.serviceVisitPool.findMany).toHaveBeenCalledWith({
      where: { serviceVisitId: visitId, companyId },
      include: { pool: true },
    });
  });
});

describe("getVisitsByPool", () => {
  it("scopes through the join rows for the company", async () => {
    prismaMock.serviceVisit.findMany.mockResolvedValue([]);

    await getVisitsByPool(poolId, companyId);

    expect(prismaMock.serviceVisit.findMany).toHaveBeenCalledWith({
      where: { serviceVisitPools: { some: { poolId, companyId } } },
      orderBy: { createdAt: "desc" },
      include: {
        waterReadings: { where: { serviceVisitPool: { poolId } } },
        chemicalsAdded: { where: { serviceVisitPool: { poolId } } },
        tech: true,
      },
    });
  });

  it("applies the take limit when provided", async () => {
    prismaMock.serviceVisit.findMany.mockResolvedValue([]);

    await getVisitsByPool(poolId, companyId, 5);

    expect(prismaMock.serviceVisit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
  });

  it("omits take when no limit is provided", async () => {
    prismaMock.serviceVisit.findMany.mockResolvedValue([]);

    await getVisitsByPool(poolId, companyId);

    const args = prismaMock.serviceVisit.findMany.mock.calls[0][0];
    expect(args).not.toHaveProperty("take");
  });
});

describe("assertPoolsBelongToCompany", () => {
  it("passes when every pool belongs to the company", async () => {
    prismaMock.pool.findMany.mockResolvedValue([{ id: poolId }]);

    await expect(assertPoolsBelongToCompany([poolId], companyId)).resolves.toBeUndefined();

    expect(prismaMock.pool.findMany).toHaveBeenCalledWith({
      where: { id: { in: [poolId] }, companyId },
      select: { id: true },
    });
  });

  it("throws when a pool does not belong to the company", async () => {
    prismaMock.pool.findMany.mockResolvedValue([]);

    await expect(
      assertPoolsBelongToCompany([poolId], companyId),
    ).rejects.toThrow(/not found/i);
  });

  it("throws when the pools array is empty", async () => {
    await expect(
      assertPoolsBelongToCompany([], companyId),
    ).rejects.toThrow(/at least one pool/i);
    expect(prismaMock.pool.findMany).not.toHaveBeenCalled();
  });
});
