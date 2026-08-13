import { describe, expect, it, beforeEach, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const {
  addVisitPhoto,
  listVisitPhotos,
  deleteVisitPhoto,
  reorderVisitPhotos,
} = await import("@/lib/db/visit-photos");

const companyId = "company-1";
const serviceVisitPoolId = "svp-1";
const visitPhotoId = "photo-1";

const mockPhoto = {
  id: visitPhotoId,
  serviceVisitPoolId,
  companyId,
  url: "https://example.com/photo-1.jpg",
  category: "EQUIPMENT",
  sortOrder: 0,
  createdAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("addVisitPhoto", () => {
  it("auto-appends sortOrder (max + 1) when omitted", async () => {
    prismaMock.serviceVisitPool.findFirst.mockResolvedValue({ id: serviceVisitPoolId });
    prismaMock.visitPhoto.findFirst.mockResolvedValue(null);
    prismaMock.visitPhoto.create.mockResolvedValue(mockPhoto);

    const result = await addVisitPhoto(
      { serviceVisitPoolId, url: mockPhoto.url },
      companyId,
    );

    expect(result).toEqual(mockPhoto);
    expect(prismaMock.visitPhoto.create).toHaveBeenCalledWith({
      data: {
        serviceVisitPoolId,
        companyId,
        url: mockPhoto.url,
        sortOrder: 0,
      },
    });
  });

  it("increments from the max existing sortOrder", async () => {
    prismaMock.serviceVisitPool.findFirst.mockResolvedValue({ id: serviceVisitPoolId });
    prismaMock.visitPhoto.findFirst.mockResolvedValue({ sortOrder: 4 });
    prismaMock.visitPhoto.create.mockResolvedValue({ ...mockPhoto, sortOrder: 5 });

    const result = await addVisitPhoto(
      { serviceVisitPoolId, url: mockPhoto.url },
      companyId,
    );

    expect(result.sortOrder).toBe(5);
    expect(prismaMock.visitPhoto.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sortOrder: 5 }) }),
    );
  });

  it("honors an explicit sortOrder and category without querying the max", async () => {
    prismaMock.serviceVisitPool.findFirst.mockResolvedValue({ id: serviceVisitPoolId });
    prismaMock.visitPhoto.create.mockResolvedValue({
      ...mockPhoto,
      sortOrder: 3,
      category: "AFTER",
    });

    const result = await addVisitPhoto(
      { serviceVisitPoolId, url: mockPhoto.url, category: "AFTER", sortOrder: 3 },
      companyId,
    );

    expect(result.sortOrder).toBe(3);
    expect(prismaMock.visitPhoto.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.visitPhoto.create).toHaveBeenCalledWith({
      data: {
        serviceVisitPoolId,
        companyId,
        url: mockPhoto.url,
        category: "AFTER",
        sortOrder: 3,
      },
    });
  });

  it("throws before writing when the body is missing or foreign", async () => {
    prismaMock.serviceVisitPool.findFirst.mockResolvedValue(null);

    await expect(
      addVisitPhoto({ serviceVisitPoolId, url: mockPhoto.url }, companyId),
    ).rejects.toThrow(/not found/i);
    expect(prismaMock.visitPhoto.create).not.toHaveBeenCalled();
  });
});

describe("listVisitPhotos", () => {
  it("returns scoped photos ordered by sortOrder then createdAt", async () => {
    prismaMock.visitPhoto.findMany.mockResolvedValue([mockPhoto]);

    const result = await listVisitPhotos(serviceVisitPoolId, companyId);

    expect(result).toEqual([mockPhoto]);
    expect(prismaMock.visitPhoto.findMany).toHaveBeenCalledWith({
      where: { serviceVisitPoolId, companyId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  });

  it("returns [] for a cross-tenant body", async () => {
    prismaMock.visitPhoto.findMany.mockResolvedValue([]);
    expect(await listVisitPhotos(serviceVisitPoolId, "wrong-company")).toEqual([]);
  });
});

describe("deleteVisitPhoto", () => {
  it("deletes a photo scoped to the company and returns the deleted row", async () => {
    prismaMock.visitPhoto.findFirst.mockResolvedValue(mockPhoto);
    prismaMock.visitPhoto.delete.mockResolvedValue(mockPhoto);

    const result = await deleteVisitPhoto(visitPhotoId, companyId);

    expect(result).toEqual(mockPhoto);
    expect(prismaMock.visitPhoto.findFirst).toHaveBeenCalledWith({
      where: { id: visitPhotoId, companyId },
    });
    expect(prismaMock.visitPhoto.delete).toHaveBeenCalledWith({
      where: { id: visitPhotoId },
    });
  });

  it("returns null without deleting when the photo is missing or foreign", async () => {
    prismaMock.visitPhoto.findFirst.mockResolvedValue(null);

    const result = await deleteVisitPhoto(visitPhotoId, companyId);

    expect(result).toBeNull();
    expect(prismaMock.visitPhoto.delete).not.toHaveBeenCalled();
  });

  it("propagates a delete failure", async () => {
    prismaMock.visitPhoto.findFirst.mockResolvedValue(mockPhoto);
    prismaMock.visitPhoto.delete.mockRejectedValue(new Error("DB down"));

    await expect(deleteVisitPhoto(visitPhotoId, companyId)).rejects.toThrow(
      "DB down",
    );
  });
});

describe("reorderVisitPhotos", () => {
  it("applies the caller ordering transactionally", async () => {
    prismaMock.serviceVisitPool.findFirst.mockResolvedValue({ id: serviceVisitPoolId });
    prismaMock.visitPhoto.findMany.mockResolvedValue([
      { id: "photo-1" },
      { id: "photo-2" },
    ]);
    prismaMock.$transaction.mockResolvedValue([mockPhoto, { ...mockPhoto, id: "photo-2" }]);

    await reorderVisitPhotos(serviceVisitPoolId, companyId, ["photo-1", "photo-2"]);

    expect(prismaMock.visitPhoto.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["photo-1", "photo-2"] }, serviceVisitPoolId, companyId },
      select: { id: true },
    });
    expect(prismaMock.visitPhoto.update).toHaveBeenNthCalledWith(1, {
      where: { id: "photo-1" },
      data: { sortOrder: 0 },
    });
    expect(prismaMock.visitPhoto.update).toHaveBeenNthCalledWith(2, {
      where: { id: "photo-2" },
      data: { sortOrder: 1 },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("throws before any write when a photo id is missing or foreign", async () => {
    prismaMock.serviceVisitPool.findFirst.mockResolvedValue({ id: serviceVisitPoolId });
    prismaMock.visitPhoto.findMany.mockResolvedValue([{ id: "photo-1" }]);

    await expect(
      reorderVisitPhotos(serviceVisitPoolId, "wrong-company", ["photo-1", "photo-2"]),
    ).rejects.toThrow(/not found/i);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("throws before any write when the body is foreign", async () => {
    prismaMock.serviceVisitPool.findFirst.mockResolvedValue(null);

    await expect(
      reorderVisitPhotos(serviceVisitPoolId, "wrong-company", ["photo-1"]),
    ).rejects.toThrow(/not found/i);
    expect(prismaMock.visitPhoto.findMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});