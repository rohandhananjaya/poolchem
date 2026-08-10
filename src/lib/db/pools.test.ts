import { describe, expect, it, beforeEach, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { prismaMock } from "@/test/prisma-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const {
  getPoolsByCompany,
  getPoolById,
  createPool,
  createPoolsBulk,
  getAllPoolsForExport,
  updatePool,
  deletePool,
  getPoolByQR,
  getPoolByPublicToken,
  generateQRCode,
  getPoolsPaginated,
} = await import("@/lib/db/pools");

const companyId = "company-1";
const poolId = "pool-1";

const mockPool = {
  id: poolId,
  name: "Test Pool",
  volume: 10_000,
  companyId,
  isActive: true,
  address: "123 Pool St",
  notes: null,
  qrCode: "POOL-abc",
  publicToken: "tok_abc",
  propertyId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockProperty = {
  id: "property-1",
  name: "Lake House",
  address: "123 Pool St",
  notes: null,
  companyId,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPoolsByCompany", () => {
  it("returns active pools with lastVisitAt", async () => {
    prismaMock.pool.findMany.mockResolvedValue([
      {
        ...mockPool,
        serviceVisits: [{ createdAt: new Date("2026-07-10") }],
      },
    ]);

    const result = await getPoolsByCompany(companyId);

    expect(result).toHaveLength(1);
    expect(result[0].lastVisitAt).toBeInstanceOf(Date);
    expect(result[0].id).toBe(poolId);
    expect(prismaMock.pool.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId, isActive: true } }),
    );
  });

  it("returns empty array when no pools", async () => {
    prismaMock.pool.findMany.mockResolvedValue([]);
    expect(await getPoolsByCompany(companyId)).toEqual([]);
  });
});

describe("getPoolById", () => {
  it("returns pool when it belongs to the company", async () => {
    prismaMock.pool.findFirst.mockResolvedValue(mockPool);
    const result = await getPoolById(poolId, companyId);
    expect(result).toEqual(mockPool);
  });

  it("returns null when pool does not belong to the company", async () => {
    prismaMock.pool.findFirst.mockResolvedValue(null);
    const result = await getPoolById(poolId, "wrong-company");
    expect(result).toBeNull();
  });
});

describe("createPool", () => {
  it("creates a pool with a generated QR code", async () => {
    prismaMock.pool.create.mockResolvedValue(mockPool);

    const result = await createPool(
      { name: "New Pool", volume: 15_000 },
      companyId,
    );

    expect(prismaMock.pool.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "New Pool",
        volume: 15_000,
        qrCode: expect.stringMatching(/^POOL-/),
        companyId,
      }),
    });
    expect(result).toEqual(mockPool);
  });

  it("passes homeownerEmail and homeownerPhone through", async () => {
    prismaMock.pool.create.mockResolvedValue(mockPool);

    await createPool(
      {
        name: "New Pool",
        volume: 15_000,
        homeownerEmail: "owner@example.com",
        homeownerPhone: "555-1234",
      },
      companyId,
    );

    expect(prismaMock.pool.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        homeownerEmail: "owner@example.com",
        homeownerPhone: "555-1234",
      }),
    });
  });

  it("sets propertyId when the property belongs to the same company", async () => {
    prismaMock.property.findFirst.mockResolvedValue(mockProperty);
    prismaMock.pool.create.mockResolvedValue(mockPool);

    await createPool(
      { name: "New Pool", volume: 15_000, propertyId: "property-1" },
      companyId,
    );

    expect(prismaMock.pool.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ propertyId: "property-1" }),
    });
  });

  it("throws when propertyId belongs to another company", async () => {
    prismaMock.property.findFirst.mockResolvedValue(null);

    await expect(
      createPool(
        { name: "New Pool", volume: 15_000, propertyId: "property-1" },
        companyId,
      ),
    ).rejects.toThrow(/not found/i);
    expect(prismaMock.pool.create).not.toHaveBeenCalled();
  });
});

describe("createPoolsBulk", () => {
  it("creates all rows when every one succeeds", async () => {
    prismaMock.pool.create
      .mockResolvedValueOnce({ ...mockPool, id: "pool-1", name: "Pool 1" })
      .mockResolvedValueOnce({ ...mockPool, id: "pool-2", name: "Pool 2" });

    const result = await createPoolsBulk(
      [
        { name: "Pool 1", volume: 10_000 },
        { name: "Pool 2", volume: 20_000 },
      ],
      companyId,
    );

    expect(result.created).toHaveLength(2);
    expect(result.failed).toEqual([]);
  });

  it("isolates a single-row failure while still creating the rest", async () => {
    prismaMock.pool.create
      .mockResolvedValueOnce({ ...mockPool, id: "pool-1", name: "Pool 1" })
      .mockRejectedValueOnce(new Error("db error"))
      .mockResolvedValueOnce({ ...mockPool, id: "pool-3", name: "Pool 3" });

    const result = await createPoolsBulk(
      [
        { name: "Pool 1", volume: 10_000 },
        { name: "Pool 2", volume: 20_000 },
        { name: "Pool 3", volume: 30_000 },
      ],
      companyId,
    );

    expect(result.created).toHaveLength(2);
    expect(result.failed).toEqual([{ index: 1, error: "Could not create this pool." }]);
  });
});

describe("getAllPoolsForExport", () => {
  it("returns active and inactive pools, scoped and ordered by name", async () => {
    prismaMock.pool.findMany.mockResolvedValue([mockPool, { ...mockPool, id: "pool-2", isActive: false }]);

    const result = await getAllPoolsForExport(companyId);

    expect(prismaMock.pool.findMany).toHaveBeenCalledWith({
      where: { companyId },
      orderBy: { name: "asc" },
    });
    expect(result).toHaveLength(2);
  });
});

describe("updatePool", () => {
  it("updates and returns the pool when it belongs to the company", async () => {
    prismaMock.pool.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.pool.findUniqueOrThrow.mockResolvedValue(mockPool);

    const result = await updatePool(poolId, { name: "Updated" }, companyId);

    expect(prismaMock.pool.updateMany).toHaveBeenCalledWith({
      where: { id: poolId, companyId },
      data: { name: "Updated" },
    });
    expect(result).toEqual(mockPool);
  });

  it("throws when pool is not found in the company", async () => {
    prismaMock.pool.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updatePool(poolId, { name: "Updated" }, companyId),
    ).rejects.toThrow(/not found/i);
  });

  it("sets propertyId when the property belongs to the same company", async () => {
    prismaMock.property.findFirst.mockResolvedValue(mockProperty);
    prismaMock.pool.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.pool.findUniqueOrThrow.mockResolvedValue(mockPool);

    await updatePool(
      poolId,
      { name: "Updated", propertyId: "property-1" },
      companyId,
    );

    expect(prismaMock.pool.updateMany).toHaveBeenCalledWith({
      where: { id: poolId, companyId },
      data: { name: "Updated", propertyId: "property-1" },
    });
  });

  it("clears propertyId when null is passed", async () => {
    prismaMock.pool.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.pool.findUniqueOrThrow.mockResolvedValue(mockPool);

    await updatePool(poolId, { propertyId: null }, companyId);

    expect(prismaMock.property.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.pool.updateMany).toHaveBeenCalledWith({
      where: { id: poolId, companyId },
      data: { propertyId: null },
    });
  });

  it("throws when propertyId belongs to another company", async () => {
    prismaMock.property.findFirst.mockResolvedValue(null);

    await expect(
      updatePool(poolId, { propertyId: "property-1" }, companyId),
    ).rejects.toThrow(/not found/i);
    expect(prismaMock.pool.updateMany).not.toHaveBeenCalled();
  });
});

describe("deletePool", () => {
  it("deletes the pool when it belongs to the company", async () => {
    prismaMock.pool.delete.mockResolvedValue(mockPool);

    await deletePool(poolId, companyId);

    expect(prismaMock.pool.delete).toHaveBeenCalledWith({
      where: { id: poolId, companyId },
    });
  });

  it("throws with a friendly error on P2025", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("Not found", {
      code: "P2025",
      clientVersion: "7",
    });
    prismaMock.pool.delete.mockRejectedValue(error);

    await expect(deletePool(poolId, companyId)).rejects.toThrow(
      /not found/i,
    );
  });
});

describe("getPoolByQR", () => {
  it("returns a pool by its QR code", async () => {
    prismaMock.pool.findUnique.mockResolvedValue(mockPool);
    const result = await getPoolByQR("POOL-abc");
    expect(result).toEqual(mockPool);
  });

  it("returns null for unknown QR code", async () => {
    prismaMock.pool.findUnique.mockResolvedValue(null);
    const result = await getPoolByQR("POOL-unknown");
    expect(result).toBeNull();
  });
});

describe("getPoolByPublicToken", () => {
  it("returns pool with company and visits", async () => {
    const mockResponse = {
      ...mockPool,
      company: { name: "Test Co" },
      serviceVisits: [],
    };
    prismaMock.pool.findUnique.mockResolvedValue(mockResponse);

    const result = await getPoolByPublicToken("tok_abc", 5);

    expect(prismaMock.pool.findUnique).toHaveBeenCalledWith({
      where: { publicToken: "tok_abc" },
      include: expect.objectContaining({
        company: true,
        serviceVisits: expect.objectContaining({ take: 5 }),
      }),
    });
    expect(result).toEqual(mockResponse);
  });
});

describe("generateQRCode", () => {
  it("generates and assigns a new QR code", async () => {
    prismaMock.pool.update.mockResolvedValue({ ...mockPool, qrCode: "POOL-new" });

    const result = await generateQRCode(poolId);

    expect(result).toMatch(/^POOL-/);
    expect(prismaMock.pool.update).toHaveBeenCalledWith({
      where: { id: poolId },
      data: { qrCode: expect.stringMatching(/^POOL-/) },
    });
  });

  it("throws P2025 as a friendly error", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("Not found", {
      code: "P2025",
      clientVersion: "7",
    });
    prismaMock.pool.update.mockRejectedValue(error);

    await expect(generateQRCode(poolId)).rejects.toThrow(/not found/i);
  });
});

describe("getPoolsPaginated", () => {
  it("returns paginated pools with total count", async () => {
    prismaMock.pool.findMany.mockResolvedValue([
      {
        ...mockPool,
        serviceVisits: [],
      },
    ]);
    prismaMock.pool.count.mockResolvedValue(1);

    const result = await getPoolsPaginated(companyId, 1);

    expect(result.pools).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(prismaMock.pool.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
  });

  it("filters by search term", async () => {
    prismaMock.pool.findMany.mockResolvedValue([]);
    prismaMock.pool.count.mockResolvedValue(0);

    await getPoolsPaginated(companyId, 1, { search: "test" });

    expect(prismaMock.pool.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { name: { contains: "test" } },
          ]),
        }),
      }),
    );
  });
});
