import { describe, expect, it, beforeEach, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const {
  getTodayVisits,
  getVisitById,
  createVisit,
  completeVisit,
  saveDraftVisit,
  getVisitHistory,
  getLastVisitReadings,
  startVisit,
  updateVisitStatus,
  cancelVisit,
  assertVisitAccess,
  updateVisit,
} = await import("@/lib/db/visits");

const companyId = "company-1";
const poolId = "pool-1";
const techId = "user-1";
const visitId = "visit-1";

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
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTech = {
  id: techId,
  name: "Tech User",
  email: "tech@test.com",
  role: "TECH",
  companyId,
  phone: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getTodayVisits", () => {
  it("returns visits scoped to company with pool and tech included", async () => {
    const mockVisits = [{ id: visitId, pool: mockPool, tech: mockTech }];
    prismaMock.serviceVisit.findMany.mockResolvedValue(mockVisits);

    const result = await getTodayVisits(companyId);

    expect(prismaMock.serviceVisit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          pool: { companyId },
          OR: [
            { scheduledAt: expect.objectContaining({ gte: expect.any(Date), lt: expect.any(Date) }) },
            { scheduledAt: null, createdAt: expect.objectContaining({ gte: expect.any(Date), lt: expect.any(Date) }) },
          ],
        }),
        include: { pool: true, tech: true },
        orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      }),
    );
    expect(result).toEqual(mockVisits);
  });

  it("returns empty array when no visits today", async () => {
    prismaMock.serviceVisit.findMany.mockResolvedValue([]);
    const result = await getTodayVisits(companyId);
    expect(result).toEqual([]);
  });
});

describe("getVisitById", () => {
  it("returns visit with readings and chemicals when pool belongs to company", async () => {
    const mockVisit = {
      id: visitId,
      pool: mockPool,
      tech: mockTech,
      waterReadings: [],
      chemicalsAdded: [],
    };
    prismaMock.serviceVisit.findFirst.mockResolvedValue(mockVisit);

    const result = await getVisitById(visitId, companyId);

    expect(prismaMock.serviceVisit.findFirst).toHaveBeenCalledWith({
      where: { id: visitId, pool: { companyId } },
      include: { pool: true, tech: true, waterReadings: true, chemicalsAdded: true },
    });
    expect(result).toEqual(mockVisit);
  });

  it("returns null for cross-tenant access", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue(null);
    const result = await getVisitById(visitId, "wrong-company");
    expect(result).toBeNull();
  });
});

describe("createVisit", () => {
  it("creates a DRAFT visit when pool and tech are found", async () => {
    prismaMock.pool.findFirst.mockResolvedValue(mockPool);
    prismaMock.user.findFirst.mockResolvedValue(mockTech);
    prismaMock.serviceVisit.create.mockResolvedValue({
      id: visitId,
      status: "DRAFT",
    });

    const result = await createVisit(poolId, techId, companyId);

    expect(prismaMock.serviceVisit.create).toHaveBeenCalledWith({
      data: {
        status: "DRAFT",
        scheduledAt: null,
        poolId: poolId,
        techId: techId,
      },
    });
    expect(result.status).toBe("DRAFT");
  });

  it("throws when pool is not found in the company", async () => {
    prismaMock.pool.findFirst.mockResolvedValue(null);

    await expect(createVisit(poolId, techId, companyId)).rejects.toThrow(
      /not found/i,
    );
  });

  it("throws when tech is not found in the company", async () => {
    prismaMock.pool.findFirst.mockResolvedValue(mockPool);
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(createVisit(poolId, techId, companyId)).rejects.toThrow(
      /not found/i,
    );
  });

  it("passes scheduledAt when provided", async () => {
    const scheduledAt = new Date("2026-07-15T12:00:00Z");
    prismaMock.pool.findFirst.mockResolvedValue(mockPool);
    prismaMock.user.findFirst.mockResolvedValue(mockTech);
    prismaMock.serviceVisit.create.mockResolvedValue({
      id: visitId,
      status: "DRAFT",
    });

    await createVisit(poolId, techId, companyId, scheduledAt);

    expect(prismaMock.serviceVisit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ scheduledAt }),
    });
  });
});

describe("completeVisit", () => {
  const readings = {
    ph: 7.5,
    freeChlorine: 2,
    totalAlkalinity: 100,
    calciumHardness: 300,
    cyanuricAcid: 40,
    temperature: 80,
  };

  const chemicals = [{ name: "Chlorine", amount: 1, unit: "gal" }];

  it("throws when visit is not found", async () => {
    prismaMock.serviceVisit.findUnique.mockResolvedValue(null);

    await expect(
      completeVisit(visitId, readings, chemicals),
    ).rejects.toThrow(/not found/i);
  });

  it("completes a visit using a transaction", async () => {
    const existingVisit = {
      id: visitId,
      pool: { ...mockPool, volume: 10_000 },
    };
    prismaMock.serviceVisit.findUnique.mockResolvedValue(existingVisit);

    const txMock = {
      waterReading: { create: vi.fn().mockResolvedValue({}) },
      chemicalAdded: { createMany: vi.fn().mockResolvedValue({}) },
      serviceVisit: {
        update: vi.fn().mockResolvedValue({
          id: visitId,
          status: "COMPLETED",
          pool: mockPool,
          tech: mockTech,
          waterReadings: [readings],
          chemicalsAdded: chemicals,
        }),
      },
    };
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    const result = await completeVisit(
      visitId,
      readings,
      chemicals,
      "All good",
    );

    expect(txMock.waterReading.create).toHaveBeenCalledWith({
      data: { visitId, ...readings },
    });
    expect(txMock.chemicalAdded.createMany).toHaveBeenCalledWith({
      data: chemicals.map((c) => ({ visitId, ...c })),
    });
    expect(txMock.serviceVisit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: visitId },
        data: { status: "COMPLETED", notes: "All good" },
      }),
    );
    expect(result.visit.status).toBe("COMPLETED");
  });

  it("skips chemical creation when none are provided", async () => {
    const existingVisit = {
      id: visitId,
      pool: { ...mockPool, volume: 10_000 },
    };
    prismaMock.serviceVisit.findUnique.mockResolvedValue(existingVisit);

    const txMock = {
      waterReading: { create: vi.fn().mockResolvedValue({}) },
      chemicalAdded: { createMany: vi.fn() },
      serviceVisit: {
        update: vi.fn().mockResolvedValue({
          id: visitId,
          status: "COMPLETED",
          pool: mockPool,
          tech: mockTech,
          waterReadings: [readings],
          chemicalsAdded: [],
        }),
      },
    };
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    await completeVisit(visitId, readings, []);

    expect(txMock.chemicalAdded.createMany).not.toHaveBeenCalled();
  });

  it("returns recommendations and water health from chemistry engine", async () => {
    const existingVisit = {
      id: visitId,
      pool: { ...mockPool, volume: 10_000 },
    };
    prismaMock.serviceVisit.findUnique.mockResolvedValue(existingVisit);

    const txMock = {
      waterReading: { create: vi.fn().mockResolvedValue({}) },
      chemicalAdded: { createMany: vi.fn() },
      serviceVisit: {
        update: vi.fn().mockResolvedValue({
          id: visitId,
          status: "COMPLETED",
          pool: mockPool,
          tech: mockTech,
          waterReadings: [readings],
          chemicalsAdded: [],
        }),
      },
    };
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    const result = await completeVisit(visitId, readings, []);

    expect(result.recommendations).toEqual([]); // ideal readings
    expect(result.waterHealth.score).toBe(100);
    expect(result.waterHealth.status).toBe("EXCELLENT");
  });

  it("auto-schedules a DRAFT next visit inheriting the tech when nextServiceDate is set and none is upcoming", async () => {
    const existingVisit = {
      id: visitId,
      techId,
      pool: { ...mockPool, volume: 10_000 },
    };
    prismaMock.serviceVisit.findUnique.mockResolvedValue(existingVisit);

    const nextServiceDate = new Date("2026-08-15T12:00:00");
    const txMock = {
      waterReading: { create: vi.fn().mockResolvedValue({}) },
      chemicalAdded: { createMany: vi.fn() },
      serviceVisit: {
        update: vi.fn().mockResolvedValue({
          id: visitId,
          status: "COMPLETED",
          pool: mockPool,
          tech: mockTech,
          waterReadings: [readings],
          chemicalsAdded: [],
        }),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    await completeVisit(visitId, readings, [], null, nextServiceDate);

    expect(txMock.serviceVisit.findFirst).toHaveBeenCalledWith({
      where: {
        poolId,
        id: { not: visitId },
        scheduledAt: { gte: expect.any(Date) },
        status: { not: "CANCELLED" },
      },
      select: { id: true },
    });
    expect(txMock.serviceVisit.create).toHaveBeenCalledWith({
      data: {
        status: "DRAFT",
        poolId,
        techId,
        scheduledAt: nextServiceDate,
      },
    });
  });

  it("skips creating a next visit when one is already upcoming for the pool", async () => {
    const existingVisit = {
      id: visitId,
      techId,
      pool: { ...mockPool, volume: 10_000 },
    };
    prismaMock.serviceVisit.findUnique.mockResolvedValue(existingVisit);

    const txMock = {
      waterReading: { create: vi.fn().mockResolvedValue({}) },
      chemicalAdded: { createMany: vi.fn() },
      serviceVisit: {
        update: vi.fn().mockResolvedValue({
          id: visitId,
          status: "COMPLETED",
          pool: mockPool,
          tech: mockTech,
          waterReadings: [readings],
          chemicalsAdded: [],
        }),
        findFirst: vi.fn().mockResolvedValue({ id: "other-visit" }),
        create: vi.fn(),
      },
    };
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    await completeVisit(
      visitId,
      readings,
      [],
      null,
      new Date("2026-08-15T12:00:00"),
    );

    expect(txMock.serviceVisit.create).not.toHaveBeenCalled();
  });

  it("does not attempt to schedule a next visit when nextServiceDate is not provided", async () => {
    const existingVisit = {
      id: visitId,
      techId,
      pool: { ...mockPool, volume: 10_000 },
    };
    prismaMock.serviceVisit.findUnique.mockResolvedValue(existingVisit);

    const txMock = {
      waterReading: { create: vi.fn().mockResolvedValue({}) },
      chemicalAdded: { createMany: vi.fn() },
      serviceVisit: {
        update: vi.fn().mockResolvedValue({
          id: visitId,
          status: "COMPLETED",
          pool: mockPool,
          tech: mockTech,
          waterReadings: [readings],
          chemicalsAdded: [],
        }),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    };
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    await completeVisit(visitId, readings, []);

    expect(txMock.serviceVisit.findFirst).not.toHaveBeenCalled();
    expect(txMock.serviceVisit.create).not.toHaveBeenCalled();
  });
});

describe("saveDraftVisit", () => {
  const readings = {
    ph: 7.4,
    freeChlorine: 1,
    totalAlkalinity: 80,
    calciumHardness: 200,
    cyanuricAcid: 30,
    temperature: 75,
  };

  it("throws when visit is not found", async () => {
    prismaMock.serviceVisit.findUnique.mockResolvedValue(null);

    await expect(
      saveDraftVisit(visitId, readings, []),
    ).rejects.toThrow(/not found/i);
  });

  it("replaces readings and chemicals in a transaction", async () => {
    prismaMock.serviceVisit.findUnique.mockResolvedValue({
      id: visitId,
      status: "DRAFT",
    });

    const txMock = {
      waterReading: {
        deleteMany: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
      chemicalAdded: {
        deleteMany: vi.fn().mockResolvedValue({}),
        createMany: vi.fn().mockResolvedValue({}),
      },
      serviceVisit: {
        update: vi.fn().mockResolvedValue({
          id: visitId,
          status: "DRAFT",
          pool: mockPool,
          tech: mockTech,
          waterReadings: [readings],
          chemicalsAdded: [],
        }),
      },
    };
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    await saveDraftVisit(visitId, readings, [], "Draft notes");

    expect(txMock.waterReading.deleteMany).toHaveBeenCalledWith({
      where: { visitId },
    });
    expect(txMock.waterReading.create).toHaveBeenCalledWith({
      data: { visitId, ...readings },
    });
    expect(txMock.chemicalAdded.deleteMany).toHaveBeenCalledWith({
      where: { visitId },
    });
    expect(txMock.serviceVisit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: visitId },
        data: { notes: "Draft notes" },
      }),
    );
  });
});

describe("getVisitHistory", () => {
  it("returns completed visits newest first with a limit", async () => {
    const mockHistory = [{ id: visitId, waterReadings: [], chemicalsAdded: [] }];
    prismaMock.serviceVisit.findMany.mockResolvedValue(mockHistory);

    const result = await getVisitHistory(poolId, 5);

    expect(prismaMock.serviceVisit.findMany).toHaveBeenCalledWith({
      where: { poolId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { waterReadings: true, chemicalsAdded: true, tech: true },
    });
    expect(result).toEqual(mockHistory);
  });
});

describe("getLastVisitReadings", () => {
  it("returns readings from the most recent completed visit", async () => {
    const mockReadings = {
      ph: 7.5,
      freeChlorine: 2,
      totalAlkalinity: 100,
      calciumHardness: 300,
      cyanuricAcid: 40,
      temperature: 80,
    };
    prismaMock.serviceVisit.findMany.mockResolvedValue([
      { waterReadings: [mockReadings] },
    ]);

    const result = await getLastVisitReadings(poolId);

    expect(result).toEqual(mockReadings);
  });

  it("returns null when no completed visits exist", async () => {
    prismaMock.serviceVisit.findMany.mockResolvedValue([]);
    const result = await getLastVisitReadings(poolId);
    expect(result).toBeNull();
  });
});

describe("startVisit", () => {
  it("marks a DRAFT visit as IN_PROGRESS and assigns tech", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue({
      id: visitId,
      status: "DRAFT",
      techId: null,
    });
    prismaMock.serviceVisit.update.mockResolvedValue({
      id: visitId,
      status: "IN_PROGRESS",
      techId,
    });

    const result = await startVisit(visitId, companyId, techId);

    expect(prismaMock.serviceVisit.findFirst).toHaveBeenCalledWith({
      where: { id: visitId, pool: { companyId }, status: "DRAFT" },
    });
    expect(prismaMock.serviceVisit.update).toHaveBeenCalledWith({
      where: { id: visitId },
      data: { status: "IN_PROGRESS", techId },
    });
    expect(result?.status).toBe("IN_PROGRESS");
  });

  it("keeps existing techId when none provided", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue({
      id: visitId,
      status: "DRAFT",
      techId,
    });
    prismaMock.serviceVisit.update.mockResolvedValue({
      id: visitId,
      status: "IN_PROGRESS",
      techId,
    });

    await startVisit(visitId, companyId);

    expect(prismaMock.serviceVisit.update).toHaveBeenCalledWith({
      where: { id: visitId },
      data: { status: "IN_PROGRESS", techId },
    });
  });

  it("returns null when visit is not DRAFT or not scoped", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue(null);

    const result = await startVisit(visitId, companyId);
    expect(result).toBeNull();
  });
});

describe("updateVisitStatus", () => {
  it("updates status when visit is found and scoped", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue({
      id: visitId,
      status: "IN_PROGRESS",
    });
    prismaMock.serviceVisit.update.mockResolvedValue({
      id: visitId,
      status: "COMPLETED",
    });

    const result = await updateVisitStatus(visitId, companyId, "COMPLETED" as never);

    expect(prismaMock.serviceVisit.update).toHaveBeenCalledWith({
      where: { id: visitId },
      data: { status: "COMPLETED" },
    });
    expect(result?.status).toBe("COMPLETED");
  });

  it("returns null when visit is not found", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue(null);

    const result = await updateVisitStatus(visitId, "wrong-company", "COMPLETED" as never);
    expect(result).toBeNull();
  });
});

describe("cancelVisit", () => {
  it("cancels a visit with a reason", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue({ id: visitId });
    prismaMock.serviceVisit.update.mockResolvedValue({
      id: visitId,
      status: "CANCELLED",
      cancellationReason: "Client requested",
    });

    const result = await cancelVisit(visitId, companyId, "Client requested");

    expect(prismaMock.serviceVisit.update).toHaveBeenCalledWith({
      where: { id: visitId },
      data: { status: "CANCELLED", cancellationReason: "Client requested" },
    });
    expect(result?.status).toBe("CANCELLED");
  });

  it("returns null when visit not found", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue(null);

    const result = await cancelVisit(visitId, companyId, "No reason");
    expect(result).toBeNull();
  });
});

describe("assertVisitAccess", () => {
  it("returns status when visit is found", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue({
      status: "DRAFT",
      techId: null,
    });

    const result = await assertVisitAccess(visitId, companyId, techId);
    expect(result).toBe("DRAFT");
  });

  it("throws when visit is in progress by another tech", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue({
      status: "IN_PROGRESS",
      techId: "other-tech",
    });

    await expect(
      assertVisitAccess(visitId, companyId, techId),
    ).rejects.toThrow(/in progress by another tech/i);
  });

  it("allows the assigned tech to access an IN_PROGRESS visit", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue({
      status: "IN_PROGRESS",
      techId,
    });

    const result = await assertVisitAccess(visitId, companyId, techId);
    expect(result).toBe("IN_PROGRESS");
  });

  it("throws when visit is not found", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue(null);

    await expect(
      assertVisitAccess(visitId, companyId, techId),
    ).rejects.toThrow(/visit not found/i);
  });
});

describe("updateVisit", () => {
  it("updates scheduledAt and techId", async () => {
    const newDate = new Date("2026-07-20");
    prismaMock.serviceVisit.findFirst.mockResolvedValue({
      id: visitId,
      pool: { companyId },
      techId: null,
    });
    prismaMock.user.findFirst.mockResolvedValue({ id: techId, companyId });
    prismaMock.serviceVisit.update.mockResolvedValue({
      id: visitId,
      scheduledAt: newDate,
      techId,
    });

    const result = await updateVisit(visitId, companyId, {
      scheduledAt: newDate,
      techId,
    });

    expect(prismaMock.serviceVisit.update).toHaveBeenCalledWith({
      where: { id: visitId },
      data: { scheduledAt: newDate, techId },
    });
    expect(result?.visit.techId).toBe(techId);
    expect(result?.previousTechId).toBeNull();
  });

  it("unassigns tech when techId is null", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue({
      id: visitId,
      pool: { companyId },
    });
    prismaMock.serviceVisit.update.mockResolvedValue({
      id: visitId,
      techId: null,
    });

    await updateVisit(visitId, companyId, { techId: null });

    expect(prismaMock.serviceVisit.update).toHaveBeenCalledWith({
      where: { id: visitId },
      data: { techId: null },
    });
  });

  it("returns null when visit not found", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue(null);

    const result = await updateVisit(visitId, companyId, { scheduledAt: new Date() });
    expect(result).toBeNull();
  });

  it("throws when visit is CANCELLED", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue({
      id: visitId,
      pool: { companyId },
      status: "CANCELLED",
    });

    await expect(
      updateVisit(visitId, companyId, { scheduledAt: new Date() }),
    ).rejects.toThrow(/cancelled or completed/i);
  });

  it("throws when visit is COMPLETED", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue({
      id: visitId,
      pool: { companyId },
      status: "COMPLETED",
    });

    await expect(
      updateVisit(visitId, companyId, { techId }),
    ).rejects.toThrow(/cancelled or completed/i);
  });

  it("allows update for DRAFT visits", async () => {
    const newDate = new Date("2026-07-20");
    prismaMock.serviceVisit.findFirst.mockResolvedValue({
      id: visitId,
      pool: { companyId },
      status: "DRAFT",
    });
    prismaMock.serviceVisit.update.mockResolvedValue({
      id: visitId,
      scheduledAt: newDate,
    });

    const result = await updateVisit(visitId, companyId, { scheduledAt: newDate });

    expect(result?.visit.id).toBe(visitId);
    expect(result?.previousTechId).toBeUndefined();
  });

  it("throws when techId does not belong to the company", async () => {
    prismaMock.serviceVisit.findFirst.mockResolvedValue({
      id: visitId,
      pool: { companyId },
    });
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(
      updateVisit(visitId, companyId, { techId: "other-tech" }),
    ).rejects.toThrow(/not found for company/i);
  });
});
