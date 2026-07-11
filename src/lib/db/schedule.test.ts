import { describe, expect, it, beforeEach, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { getScheduleData } = await import("@/lib/db/schedule");

const companyId = "company-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getScheduleData", () => {
  it("returns scheduled visits mapped with effectiveDate and health", async () => {
    prismaMock.serviceVisit.findMany.mockResolvedValue([
      {
        id: "v1",
        pool: { name: "Pool A", address: "123" },
        status: "DRAFT",
        scheduledAt: new Date("2026-07-15T12:00:00Z"),
        createdAt: new Date("2026-07-11T10:00:00Z"),
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
      },
      {
        id: "v2",
        pool: { name: "Pool B", address: null },
        status: "COMPLETED",
        scheduledAt: null,
        createdAt: new Date("2026-07-11T11:00:00Z"),
        waterReadings: [],
      },
    ]);

    const result = await getScheduleData(companyId);

    expect(result).toHaveLength(2);
    expect(result[0].poolName).toBe("Pool A");
    expect(result[0].scheduledAt).toBe("2026-07-15T12:00:00.000Z");
    expect(result[0].effectiveDate).toBe("2026-07-15T12:00:00.000Z");
    expect(result[0].health).toEqual({ score: 100, status: "EXCELLENT" });

    expect(result[1].poolName).toBe("Pool B");
    expect(result[1].scheduledAt).toBeNull();
    expect(result[1].effectiveDate).toBe("2026-07-11T11:00:00.000Z");
    expect(result[1].health).toBeNull();
  });

  it("respects SCHEDULE_LIMIT and ordering", async () => {
    prismaMock.serviceVisit.findMany.mockResolvedValue([]);

    await getScheduleData(companyId);

    expect(prismaMock.serviceVisit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pool: { companyId }, status: { not: "CANCELLED" } },
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
        take: expect.any(Number),
      }),
    );
  });

  it("filters by status=all", async () => {
    prismaMock.serviceVisit.findMany.mockResolvedValue([]);

    await getScheduleData(companyId, { status: "all" });

    expect(prismaMock.serviceVisit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pool: { companyId } },
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
      }),
    );
  });

  it("filters by status=cancelled", async () => {
    prismaMock.serviceVisit.findMany.mockResolvedValue([]);

    await getScheduleData(companyId, { status: "cancelled" });

    const callArgs = prismaMock.serviceVisit.findMany.mock.calls[0][0];
    expect(callArgs.where).toEqual({
      pool: { companyId },
      status: "CANCELLED",
    });
  });

  it("filters by poolId", async () => {
    prismaMock.serviceVisit.findMany.mockResolvedValue([]);

    await getScheduleData(companyId, { poolId: "pool-1" });

    const callArgs = prismaMock.serviceVisit.findMany.mock.calls[0][0];
    expect(callArgs.where.poolId).toBe("pool-1");
  });

  it("filters by date range", async () => {
    prismaMock.serviceVisit.findMany.mockResolvedValue([]);

    await getScheduleData(companyId, { fromDate: "2026-07-01", toDate: "2026-07-31" });

    const callArgs = prismaMock.serviceVisit.findMany.mock.calls[0][0];
    expect(callArgs.where.scheduledAt).toBeDefined();
    expect(callArgs.where.scheduledAt.gte).toEqual(new Date("2026-07-01"));
    expect(callArgs.where.scheduledAt.lte).toEqual(new Date("2026-07-31T23:59:59.999Z"));
  });
});
