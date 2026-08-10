import { describe, expect, it, beforeEach, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { prismaMock } from "@/test/prisma-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const {
  getPropertiesByCompany,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  setPoolProperty,
} = await import("@/lib/db/properties");

const companyId = "company-1";
const propertyId = "property-1";
const poolId = "pool-1";

const mockProperty = {
  id: propertyId,
  name: "Smith Residence",
  address: "456 Lake Rd",
  notes: null,
  companyId,
  createdAt: new Date(),
  updatedAt: new Date(),
};

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
  propertyId,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPropertiesByCompany", () => {
  it("returns properties eager-loaded with their pools", async () => {
    prismaMock.property.findMany.mockResolvedValue([
      { ...mockProperty, pools: [mockPool] },
    ]);

    const result = await getPropertiesByCompany(companyId);

    expect(result).toHaveLength(1);
    expect(result[0].pools).toHaveLength(1);
    expect(result[0].pools[0].id).toBe(poolId);
    expect(prismaMock.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId },
        include: { pools: { where: { isActive: true } } },
      }),
    );
  });

  it("returns empty array when no properties", async () => {
    prismaMock.property.findMany.mockResolvedValue([]);
    expect(await getPropertiesByCompany(companyId)).toEqual([]);
  });
});

describe("getPropertyById", () => {
  it("returns property when it belongs to the company", async () => {
    prismaMock.property.findFirst.mockResolvedValue(mockProperty);
    const result = await getPropertyById(propertyId, companyId);
    expect(result).toEqual(mockProperty);
    expect(prismaMock.property.findFirst).toHaveBeenCalledWith({
      where: { id: propertyId, companyId },
    });
  });

  it("returns null when property does not belong to the company", async () => {
    prismaMock.property.findFirst.mockResolvedValue(null);
    const result = await getPropertyById(propertyId, "wrong-company");
    expect(result).toBeNull();
  });
});

describe("createProperty", () => {
  it("creates a property scoped to the company", async () => {
    prismaMock.property.create.mockResolvedValue(mockProperty);

    const result = await createProperty(
      { name: "Smith Residence", address: "456 Lake Rd" },
      companyId,
    );

    expect(prismaMock.property.create).toHaveBeenCalledWith({
      data: {
        name: "Smith Residence",
        address: "456 Lake Rd",
        notes: null,
        company: { connect: { id: companyId } },
      },
    });
    expect(result).toEqual(mockProperty);
  });
});

describe("updateProperty", () => {
  it("updates and returns the property when it belongs to the company", async () => {
    prismaMock.property.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.property.findUniqueOrThrow.mockResolvedValue(mockProperty);

    const result = await updateProperty(
      propertyId,
      { name: "Updated" },
      companyId,
    );

    expect(prismaMock.property.updateMany).toHaveBeenCalledWith({
      where: { id: propertyId, companyId },
      data: { name: "Updated" },
    });
    expect(result).toEqual(mockProperty);
  });

  it("throws when property is not found in the company", async () => {
    prismaMock.property.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateProperty(propertyId, { name: "Updated" }, companyId),
    ).rejects.toThrow(/not found/i);
  });
});

describe("deleteProperty", () => {
  it("deletes the property when it belongs to the company", async () => {
    prismaMock.property.delete.mockResolvedValue(mockProperty);

    await deleteProperty(propertyId, companyId);

    expect(prismaMock.property.delete).toHaveBeenCalledWith({
      where: { id: propertyId, companyId },
    });
  });

  it("throws with a friendly error on P2025", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("Not found", {
      code: "P2025",
      clientVersion: "7",
    });
    prismaMock.property.delete.mockRejectedValue(error);

    await expect(deleteProperty(propertyId, companyId)).rejects.toThrow(
      /not found/i,
    );
  });
});

describe("setPoolProperty", () => {
  it("attaches a pool to a same-company property", async () => {
    prismaMock.pool.findFirst.mockResolvedValue(mockPool);
    prismaMock.property.findFirst.mockResolvedValue(mockProperty);
    prismaMock.pool.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.pool.findUniqueOrThrow.mockResolvedValue(mockPool);

    const result = await setPoolProperty(poolId, propertyId, companyId);

    expect(prismaMock.pool.findFirst).toHaveBeenCalledWith({
      where: { id: poolId, companyId },
    });
    expect(prismaMock.property.findFirst).toHaveBeenCalledWith({
      where: { id: propertyId, companyId },
    });
    expect(prismaMock.pool.updateMany).toHaveBeenCalledWith({
      where: { id: poolId, companyId },
      data: { propertyId },
    });
    expect(result).toEqual(mockPool);
  });

  it("throws when the pool is not owned by the company", async () => {
    prismaMock.pool.findFirst.mockResolvedValue(null);

    await expect(
      setPoolProperty(poolId, propertyId, companyId),
    ).rejects.toThrow(/not found/i);
    expect(prismaMock.pool.updateMany).not.toHaveBeenCalled();
  });

  it("throws when the property is not owned by the company (cross-tenant FK guard)", async () => {
    prismaMock.pool.findFirst.mockResolvedValue(mockPool);
    prismaMock.property.findFirst.mockResolvedValue(null);

    await expect(
      setPoolProperty(poolId, propertyId, companyId),
    ).rejects.toThrow(/not found/i);
    expect(prismaMock.pool.updateMany).not.toHaveBeenCalled();
  });

  it("detaches the pool when propertyId is null", async () => {
    prismaMock.pool.findFirst.mockResolvedValue(mockPool);
    prismaMock.pool.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.pool.findUniqueOrThrow.mockResolvedValue({
      ...mockPool,
      propertyId: null,
    });

    const result = await setPoolProperty(poolId, null, companyId);

    expect(prismaMock.property.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.pool.updateMany).toHaveBeenCalledWith({
      where: { id: poolId, companyId },
      data: { propertyId: null },
    });
    expect(result.propertyId).toBeNull();
  });
});
