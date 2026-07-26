import { describe, expect, it, beforeEach, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { prismaMock } from "@/test/prisma-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const {
  getCompanyById,
  updateCompany,
  createCompany,
  deleteCompany,
  getCompanyStats,
  getCompaniesPaginated,
  COMPANIES_PAGE_SIZE,
} = await import("@/lib/db/company");

const companyId = "company-1";

const mockCompany = {
  id: companyId,
  name: "Test Company",
  email: "test@company.com",
  logo: null,
  phone: null,
  address: null,
  active: true,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  subscriptionStatus: null,
  paypalSubscriptionId: null,
  paypalPlanId: null,
  fromEmail: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCompanyById", () => {
  it("returns a company by id", async () => {
    prismaMock.company.findUnique.mockResolvedValue(mockCompany);
    const result = await getCompanyById(companyId);
    expect(result).toEqual(mockCompany);
  });

  it("returns null when company does not exist", async () => {
    prismaMock.company.findUnique.mockResolvedValue(null);
    const result = await getCompanyById("nonexistent");
    expect(result).toBeNull();
  });
});

describe("updateCompany", () => {
  it("updates and returns the company", async () => {
    prismaMock.company.update.mockResolvedValue({
      ...mockCompany,
      name: "Updated Co",
    });

    const result = await updateCompany(companyId, { name: "Updated Co" });

    expect(prismaMock.company.update).toHaveBeenCalledWith({
      where: { id: companyId },
      data: { name: "Updated Co" },
    });
    expect(result.name).toBe("Updated Co");
  });

  it("throws on P2025 with a friendly message", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("Not found", {
      code: "P2025",
      clientVersion: "7",
    });
    prismaMock.company.update.mockRejectedValue(error);

    await expect(
      updateCompany(companyId, { name: "X" }),
    ).rejects.toThrow(/not found/i);
  });
});

describe("createCompany", () => {
  it("creates a new company", async () => {
    prismaMock.company.create.mockResolvedValue(mockCompany);

    const result = await createCompany({
      name: "Test Company",
      email: "test@company.com",
    });

    expect(prismaMock.company.create).toHaveBeenCalledWith({
      data: { name: "Test Company", email: "test@company.com" },
    });
    expect(result).toEqual(mockCompany);
  });
});

describe("deleteCompany", () => {
  it("deletes a company", async () => {
    prismaMock.company.delete.mockResolvedValue(mockCompany);

    await deleteCompany(companyId);

    expect(prismaMock.company.delete).toHaveBeenCalledWith({
      where: { id: companyId },
    });
  });

  it("throws on P2025 with a friendly message", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("Not found", {
      code: "P2025",
      clientVersion: "7",
    });
    prismaMock.company.delete.mockRejectedValue(error);

    await expect(deleteCompany(companyId)).rejects.toThrow(/not found/i);
  });
});

describe("getCompanyStats", () => {
  it("computes stats with water health average", async () => {
    prismaMock.pool.count.mockResolvedValue(5);
    prismaMock.serviceVisit.count.mockResolvedValue(10);
    prismaMock.waterReading.findMany.mockResolvedValue([
      { ph: 7.5, freeChlorine: 2, totalAlkalinity: 100, calciumHardness: 300, cyanuricAcid: 40, temperature: 80 },
      { ph: 7.4, freeChlorine: 1, totalAlkalinity: 80, calciumHardness: 200, cyanuricAcid: 30, temperature: 75 },
    ]);

    const result = await getCompanyStats(companyId);

    expect(result.totalPools).toBe(5);
    expect(result.visitsThisMonth).toBe(10);
    expect(result.averageWaterHealth).toBe(100);
    expect(prismaMock.waterReading.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 }),
    );
  });

  it("returns null average water health when no readings exist", async () => {
    prismaMock.pool.count.mockResolvedValue(0);
    prismaMock.serviceVisit.count.mockResolvedValue(0);
    prismaMock.waterReading.findMany.mockResolvedValue([]);

    const result = await getCompanyStats(companyId);

    expect(result.averageWaterHealth).toBeNull();
  });
});

describe("getCompaniesPaginated", () => {
  const mockCompanies = Array.from({ length: 3 }, (_, i) => ({
    ...mockCompany,
    id: `company-${i + 1}`,
    name: `Company ${i + 1}`,
    _count: { users: i, pools: i * 2 },
  }));

  it("returns paginated companies with counts", async () => {
    prismaMock.company.findMany.mockResolvedValue(mockCompanies);
    prismaMock.company.count.mockResolvedValue(15);

    const result = await getCompaniesPaginated(2);

    expect(result.companies).toHaveLength(3);
    expect(result.total).toBe(15);
    expect(prismaMock.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: COMPANIES_PAGE_SIZE,
        take: COMPANIES_PAGE_SIZE,
        include: { _count: { select: { users: true, pools: true } } },
      }),
    );
    expect(prismaMock.company.count).toHaveBeenCalledOnce();
  });

  it("defaults to page 1", async () => {
    prismaMock.company.findMany.mockResolvedValue(mockCompanies);
    prismaMock.company.count.mockResolvedValue(3);

    const result = await getCompaniesPaginated();

    expect(result.companies).toHaveLength(3);
    expect(result.total).toBe(3);
    expect(prismaMock.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 }),
    );
  });

  it("returns empty array when no companies exist", async () => {
    prismaMock.company.findMany.mockResolvedValue([]);
    prismaMock.company.count.mockResolvedValue(0);

    const result = await getCompaniesPaginated(1);

    expect(result.companies).toEqual([]);
    expect(result.total).toBe(0);
  });
});
