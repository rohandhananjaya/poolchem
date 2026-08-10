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

const mockProperty = {
  id: propertyId,
  name: "Lake House",
  address: "123 Lake Rd",
  notes: null,
  companyId,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPool = {
  id: "pool-1",
  name: "Main Pool",
  volume: 10_000,
  companyId,
  isActive: true,
  address: "123 Lake Rd",
  notes: null,
  qrCode: "POOL-abc",
  publicToken: "tok_abc",
  propertyId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPropertiesByCompany", () => {
  it("returns properties with their pools, scoped and ordered by name", async () => {
    prismaMock.property.findMany.mockResolvedValue([
      { ...mockProperty, pools: [mockPool] },
    ]);

    const result = await getPropertiesByCompany(companyId);

    expect(prismaMock.property.findMany).toHaveBeenCalledWith({
      where: { companyId },
      orderBy: { name: "asc" },
      include: { pools: { orderBy: { name: "asc" } } },
    });
    expect(result).toHaveLength(1);
    expect(result[0].pools).toHaveLength(1);
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
  it("creates a property for the company", async () => {
    prismaMock.property.create.mockResolvedValue(mockProperty);

    const result = await createProperty(
      { name: "Lake House", address: "123 Lake Rd" },
      companyId,
    );

    expect(prismaMock.property.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Lake House",
        address: "123 Lake Rd",
        notes: null,
        company: { connect: { id: companyId } },
      }),
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
      { name: "Renamed" },
      companyId,
    );

    expect(prismaMock.property.updateMany).toHaveBeenCalledWith({
      where: { id: propertyId, companyId },
      data: { name: "Renamed" },
    });
    expect(result).toEqual(mockProperty);
  });

  it("throws when property is not found in the company", async () => {
    prismaMock.property.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateProperty(propertyId, { name: "Renamed" }, companyId),
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
  it("attaches a pool to a property in the same company", async () => {
    prismaMock.property.findFirst.mockResolvedValue(mockProperty);
    prismaMock.pool.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.pool.findUniqueOrThrow.mockResolvedValue({
      ...mockPool,
      propertyId,
    });

    const result = await setPoolProperty("pool-1", propertyId, companyId);

    expect(prismaMock.property.findFirst).toHaveBeenCalledWith({
      where: { id: propertyId, companyId },
    });
    expect(prismaMock.pool.updateMany).toHaveBeenCalledWith({
      where: { id: "pool-1", companyId },
      data: { propertyId },
    });
    expect(result.propertyId).toBe(propertyId);
  });

  it("detaches a pool when propertyId is null", async () => {
    prismaMock.pool.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.pool.findUniqueOrThrow.mockResolvedValue(mockPool);

    const result = await setPoolProperty("pool-1", null, companyId);

    expect(prismaMock.property.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.pool.updateMany).toHaveBeenCalledWith({
      where: { id: "pool-1", companyId },
      data: { propertyId: null },
    });
    expect(result.propertyId).toBeNull();
  });

  it("throws when the property belongs to another company", async () => {
    prismaMock.property.findFirst.mockResolvedValue(null);

    await expect(
      setPoolProperty("pool-1", propertyId, companyId),
    ).rejects.toThrow(/not found/i);
    expect(prismaMock.pool.updateMany).not.toHaveBeenCalled();
  });

  it("throws when the pool is not found in the company", async () => {
    prismaMock.property.findFirst.mockResolvedValue(mockProperty);
    prismaMock.pool.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      setPoolProperty("pool-1", propertyId, companyId),
    ).rejects.toThrow(/not found/i);
  });
});
