import { describe, expect, it, beforeEach, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { getCompanyReportData } = await import("@/lib/db/reports");

const companyId = "company-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCompanyReportData", () => {
  it("returns paginated, filtered report items with scores", async () => {
    prismaMock.serviceVisit.findMany.mockResolvedValue([
      {
        id: "v1",
        pool: { name: "Pool A", address: "123" },
        tech: { name: "Tech 1" },
        waterReadings: [
          {
            ph: 7.5,
            freeChlorine: 2,
            totalAlkalinity: 100,
            calciumHardness: 300,
            cyanuricAcid: 40,
            temperature: 80,
          },
        ],
        createdAt: new Date("2026-07-10"),
      },
    ]);
    prismaMock.serviceVisit.count.mockResolvedValue(1);

    const result = await getCompanyReportData(companyId, 1);

    expect(result.recentVisits).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.recentVisits[0].poolName).toBe("Pool A");
    expect(result.recentVisits[0].score).toBe(100);
    expect(prismaMock.serviceVisit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it("returns null score when visit has no reading", async () => {
    prismaMock.serviceVisit.findMany.mockResolvedValue([
      {
        id: "v1",
        pool: { name: "Pool A", address: null },
        tech: { name: "Tech 1" },
        waterReadings: [],
        createdAt: new Date("2026-07-10"),
      },
    ]);
    prismaMock.serviceVisit.count.mockResolvedValue(1);

    const result = await getCompanyReportData(companyId, 1);

    expect(result.recentVisits[0].score).toBeNull();
  });

  it("applies poolId and date filters", async () => {
    prismaMock.serviceVisit.findMany.mockResolvedValue([]);
    prismaMock.serviceVisit.count.mockResolvedValue(0);

    await getCompanyReportData(companyId, 1, {
      poolId: "pool-1",
      fromDate: "2026-07-01",
      toDate: "2026-07-31",
    });

    expect(prismaMock.serviceVisit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          poolId: "pool-1",
          pool: { companyId },
          createdAt: {
            gte: new Date("2026-07-01"),
            lte: new Date("2026-07-31T23:59:59.999Z"),
          },
        }),
      }),
    );
  });
});
