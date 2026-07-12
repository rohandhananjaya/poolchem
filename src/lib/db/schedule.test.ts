import { describe, expect, it, beforeEach, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { getScheduleData, SCHEDULE_PAGE_SIZE } = await import("@/lib/db/schedule");

const companyId = "company-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getScheduleData", () => {
  it("returns scheduled visits mapped with effectiveDate and health", async () => {
    prismaMock.serviceVisit.count.mockResolvedValue(1);
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
    ]);

    const result = await getScheduleData(companyId);

    expect(result.visits).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.visits[0].poolName).toBe("Pool A");
    expect(result.visits[0].scheduledAt).toBe("2026-07-15T12:00:00.000Z");
    expect(result.visits[0].effectiveDate).toBe("2026-07-15T12:00:00.000Z");
    expect(result.visits[0].health).toEqual({ score: 100, status: "EXCELLENT" });
  });

  it("respects SCHEDULE_PAGE_SIZE, skip, take, and ordering", async () => {
    prismaMock.serviceVisit.count.mockResolvedValue(0);
    prismaMock.serviceVisit.findMany.mockResolvedValue([]);

    await getScheduleData(companyId);

    expect(prismaMock.serviceVisit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pool: { companyId }, status: { in: ["DRAFT", "IN_PROGRESS"] } },
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
        skip: 0,
        take: SCHEDULE_PAGE_SIZE,
      }),
    );
    expect(prismaMock.serviceVisit.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { pool: { companyId }, status: { in: ["DRAFT", "IN_PROGRESS"] } } }),
    );
  });

  it("filters by status=all", async () => {
    prismaMock.serviceVisit.count.mockResolvedValue(0);
    prismaMock.serviceVisit.findMany.mockResolvedValue([]);

    await getScheduleData(companyId, 1, { status: "all" });

    expect(prismaMock.serviceVisit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pool: { companyId } },
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
        skip: 0,
        take: SCHEDULE_PAGE_SIZE,
      }),
    );
  });

  it("filters by status=completed", async () => {
    prismaMock.serviceVisit.count.mockResolvedValue(0);
    prismaMock.serviceVisit.findMany.mockResolvedValue([]);

    await getScheduleData(companyId, 1, { status: "completed" });

    const callArgs = prismaMock.serviceVisit.findMany.mock.calls[0][0];
    expect(callArgs.where).toEqual({
      pool: { companyId },
      status: "COMPLETED",
    });
  });

  it("filters by status=cancelled", async () => {
    prismaMock.serviceVisit.count.mockResolvedValue(0);
    prismaMock.serviceVisit.findMany.mockResolvedValue([]);

    await getScheduleData(companyId, 1, { status: "cancelled" });

    const callArgs = prismaMock.serviceVisit.findMany.mock.calls[0][0];
    expect(callArgs.where).toEqual({
      pool: { companyId },
      status: "CANCELLED",
    });
  });

  it("filters by poolId", async () => {
    prismaMock.serviceVisit.count.mockResolvedValue(0);
    prismaMock.serviceVisit.findMany.mockResolvedValue([]);

    await getScheduleData(companyId, 1, { poolId: "pool-1" });

    const callArgs = prismaMock.serviceVisit.findMany.mock.calls[0][0];
    expect(callArgs.where.poolId).toBe("pool-1");
  });

  it("filters by techId to own + unassigned visits", async () => {
    prismaMock.serviceVisit.count.mockResolvedValue(0);
    prismaMock.serviceVisit.findMany.mockResolvedValue([]);

    await getScheduleData(companyId, 1, { techId: "tech-1" });

    const callArgs = prismaMock.serviceVisit.findMany.mock.calls[0][0];
    expect(callArgs.where.OR).toEqual([{ techId: "tech-1" }, { techId: null }]);
  });

  it("filters by date range", async () => {
    prismaMock.serviceVisit.count.mockResolvedValue(0);
    prismaMock.serviceVisit.findMany.mockResolvedValue([]);

    await getScheduleData(companyId, 1, { fromDate: "2026-07-01", toDate: "2026-07-31" });

    const callArgs = prismaMock.serviceVisit.findMany.mock.calls[0][0];
    expect(callArgs.where.scheduledAt).toBeDefined();
    expect(callArgs.where.scheduledAt.gte).toEqual(new Date("2026-07-01"));
    expect(callArgs.where.scheduledAt.lte).toEqual(new Date("2026-07-31T23:59:59.999Z"));
  });
});
