import { describe, expect, it, beforeEach, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { getDashboardData } = await import("@/lib/db/dashboard");

const companyId = "company-1";

beforeEach(() => {
  vi.clearAllMocks();
});

const mockPool = { name: "Test Pool", address: "123 St" };

const mockReading = {
  ph: 7.5,
  freeChlorine: 2,
  totalAlkalinity: 100,
  calciumHardness: 300,
  cyanuricAcid: 40,
  temperature: 80,
};

describe("getDashboardData", () => {
  it("returns visits with health scores from readings", async () => {
    prismaMock.serviceVisit.findMany.mockResolvedValue([
      {
        id: "v1",
        pool: mockPool,
        waterReadings: [mockReading],
        status: "COMPLETED",
        createdAt: new Date("2026-07-11T10:00:00Z"),
        updatedAt: new Date("2026-07-11T11:00:00Z"),
      },
      {
        id: "v2",
        pool: { name: "Second Pool", address: null },
        waterReadings: [],
        status: "DRAFT",
        createdAt: new Date("2026-07-11T10:30:00Z"),
        updatedAt: new Date("2026-07-11T10:30:00Z"),
      },
    ]);
    prismaMock.pool.count.mockResolvedValue(10);

    const result = await getDashboardData(companyId);

    expect(result.visits).toHaveLength(2);
    expect(result.visits[0].health).toEqual({ score: 100, status: "EXCELLENT" });
    expect(result.visits[0].status).toBe("COMPLETED");
    expect(result.visits[1].health).toBeNull();
    expect(result.stats.completed).toBe(1);
    expect(result.stats.total).toBe(2);
    expect(result.stats.avgHealth).toBe(100);
    expect(result.stats.activePools).toBe(10);
  });

  it("returns empty data when no visits exist", async () => {
    prismaMock.serviceVisit.findMany.mockResolvedValue([]);
    prismaMock.pool.count.mockResolvedValue(0);

    const result = await getDashboardData(companyId);

    expect(result.visits).toEqual([]);
    expect(result.stats.completed).toBe(0);
    expect(result.stats.total).toBe(0);
    expect(result.stats.avgHealth).toBeNull();
    expect(result.stats.activePools).toBe(0);
  });
});
