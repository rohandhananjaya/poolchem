import { describe, expect, it, beforeEach, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { prismaMock } from "@/test/prisma-mock";
import { VisitVersionConflictError } from "@/lib/errors";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const {
  getTodayVisits,
  getVisitById,
  createVisit,
  completeVisit,
  claimReportNotification,
  releaseReportNotification,
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
      include: {
        pool: true,
        tech: true,
        waterReadings: true,
        chemicalsAdded: true,
        serviceVisitPools: { include: { pool: true } },
      },
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
  const txMock = {
    serviceVisit: {
      create: vi.fn().mockResolvedValue({
        id: visitId,
        status: "DRAFT",
        serviceVisitPools: [],
      }),
    },
    serviceVisitPool: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };

  beforeEach(() => {
    txMock.serviceVisit.create.mockResolvedValue({
      id: visitId,
      status: "DRAFT",
      serviceVisitPools: [],
    });
    txMock.serviceVisitPool.createMany.mockResolvedValue({ count: 1 });
  });

  it("creates a visit and a join row per pool transactionally", async () => {
    prismaMock.pool.findMany.mockResolvedValue([
      { id: "pool-1" },
      { id: "pool-2" },
    ]);
    prismaMock.user.findFirst.mockResolvedValue(mockTech);
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    const result = await createVisit(["pool-1", "pool-2"], techId, companyId);

    expect(txMock.serviceVisit.create).toHaveBeenCalledWith({
      data: {
        status: "DRAFT",
        scheduledAt: null,
        poolId: "pool-1",
        techId,
      },
      include: { serviceVisitPools: true },
    });
    expect(txMock.serviceVisitPool.createMany).toHaveBeenCalledWith({
      data: [
        { serviceVisitId: visitId, poolId: "pool-1", companyId },
        { serviceVisitId: visitId, poolId: "pool-2", companyId },
      ],
    });
    expect(result.id).toBe(visitId);
  });

  it("throws on an empty poolIds array before any write", async () => {
    await expect(createVisit([], techId, companyId)).rejects.toThrow(
      /at least one pool/i,
    );
    expect(prismaMock.pool.findMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("throws when any pool is missing or owned by another company", async () => {
    prismaMock.pool.findMany.mockResolvedValue([{ id: "pool-1" }]);

    await expect(
      createVisit(["pool-1", "pool-2"], techId, companyId),
    ).rejects.toThrow(/pool-2.*not found for company/i);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("dedupes duplicate poolIds into a single join row", async () => {
    prismaMock.pool.findMany.mockResolvedValue([{ id: "pool-1" }]);
    prismaMock.user.findFirst.mockResolvedValue(mockTech);
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    await createVisit(["pool-1", "pool-1"], techId, companyId);

    expect(txMock.serviceVisitPool.createMany).toHaveBeenCalledWith({
      data: [{ serviceVisitId: visitId, poolId: "pool-1", companyId }],
    });
    expect(txMock.serviceVisit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ poolId: "pool-1" }),
      include: { serviceVisitPools: true },
    });
  });

  it("throws when tech is not found in the company", async () => {
    prismaMock.pool.findMany.mockResolvedValue([{ id: "pool-1" }]);
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(
      createVisit(["pool-1"], techId, companyId),
    ).rejects.toThrow(/tech.*not found/i);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("passes scheduledAt when provided", async () => {
    const scheduledAt = new Date("2026-07-15T12:00:00Z");
    prismaMock.pool.findMany.mockResolvedValue([{ id: "pool-1" }]);
    prismaMock.user.findFirst.mockResolvedValue(mockTech);
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    await createVisit(["pool-1"], techId, companyId, scheduledAt);

    expect(txMock.serviceVisit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ scheduledAt }),
      include: { serviceVisitPools: true },
    });
  });

  it("pins the legacy poolId to the single pool for single-pool visits", async () => {
    prismaMock.pool.findMany.mockResolvedValue([{ id: "pool-1" }]);
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    await createVisit(["pool-1"], null, companyId);

    expect(txMock.serviceVisit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ poolId: "pool-1", techId: null }),
      include: { serviceVisitPools: true },
    });
    expect(txMock.serviceVisitPool.createMany).toHaveBeenCalledWith({
      data: [{ serviceVisitId: visitId, poolId: "pool-1", companyId }],
    });
  });
});

describe("completeVisit", () => {
  const joinId = "join-1";
  const readings = {
    ph: 7.5,
    freeChlorine: 2,
    totalAlkalinity: 100,
    calciumHardness: 300,
    cyanuricAcid: 40,
    temperature: 80,
  };

  const chemicals = [{ name: "Chlorine", amount: 1, unit: "gal" }];

  const bodies = [{ serviceVisitPoolId: joinId, readings, chemicals }];

  const emptyBodies = [{ serviceVisitPoolId: joinId, readings, chemicals: [] }];

  /** One join row per body — required by `assertBodiesCoverVisit`. */
  const serviceVisitPools = [{ id: joinId, pool: { ...mockPool, volume: 10_000 } }];

  it("throws when visit is not found", async () => {
    prismaMock.serviceVisit.findUnique.mockResolvedValue(null);

    await expect(
      completeVisit(visitId, bodies),
    ).rejects.toThrow(/not found/i);
  });

  it("completes a visit using a transaction", async () => {
    const existingVisit = {
      id: visitId,
      pool: { ...mockPool, volume: 10_000 },
      serviceVisitPools,
    };
    prismaMock.serviceVisit.findUnique.mockResolvedValue(existingVisit);

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
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: visitId,
          status: "COMPLETED",
          version: 1,
          pool: mockPool,
          tech: mockTech,
          waterReadings: [{ serviceVisitPoolId: joinId, ...readings }],
          chemicalsAdded: chemicals,
          serviceVisitPools,
        }),
      },
    };
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    const result = await completeVisit(
      visitId,
      bodies,
      "All good",
    );

    expect(txMock.waterReading.deleteMany).toHaveBeenCalledWith({
      where: { visitId },
    });
    expect(txMock.waterReading.create).toHaveBeenCalledWith({
      data: { visitId, serviceVisitPoolId: joinId, ...readings },
    });
    expect(txMock.chemicalAdded.deleteMany).toHaveBeenCalledWith({
      where: { visitId },
    });
    expect(txMock.chemicalAdded.createMany).toHaveBeenCalledWith({
      data: chemicals.map((c) => ({ visitId, serviceVisitPoolId: joinId, ...c })),
    });
    expect(txMock.serviceVisit.updateMany).toHaveBeenCalledWith({
      where: { id: visitId },
      data: expect.objectContaining({
        status: "COMPLETED",
        notes: "All good",
        version: { increment: 1 },
      }),
    });
    expect(txMock.serviceVisit.findUnique).toHaveBeenCalledWith({
      where: { id: visitId },
      include: {
        pool: true,
        tech: true,
        waterReadings: true,
        chemicalsAdded: true,
        serviceVisitPools: { include: { pool: true } },
      },
    });
    expect(result.visit!.status).toBe("COMPLETED");
  });

  it("skips chemical creation when none are provided", async () => {
    const existingVisit = {
      id: visitId,
      pool: { ...mockPool, volume: 10_000 },
      serviceVisitPools,
    };
    prismaMock.serviceVisit.findUnique.mockResolvedValue(existingVisit);

    const txMock = {
      waterReading: {
        deleteMany: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
      chemicalAdded: {
        deleteMany: vi.fn().mockResolvedValue({}),
        createMany: vi.fn(),
      },
      serviceVisit: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: visitId,
          status: "COMPLETED",
          version: 1,
          pool: mockPool,
          tech: mockTech,
          waterReadings: [{ serviceVisitPoolId: joinId, ...readings }],
          chemicalsAdded: [],
          serviceVisitPools,
        }),
      },
    };
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    await completeVisit(visitId, emptyBodies);

    expect(txMock.chemicalAdded.createMany).not.toHaveBeenCalled();
  });

  it("returns per-body recommendations and water health from chemistry engine", async () => {
    const existingVisit = {
      id: visitId,
      pool: { ...mockPool, volume: 10_000 },
      serviceVisitPools,
    };
    prismaMock.serviceVisit.findUnique.mockResolvedValue(existingVisit);

    const txMock = {
      waterReading: {
        deleteMany: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
      chemicalAdded: {
        deleteMany: vi.fn().mockResolvedValue({}),
        createMany: vi.fn(),
      },
      serviceVisit: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: visitId,
          status: "COMPLETED",
          version: 1,
          pool: mockPool,
          tech: mockTech,
          waterReadings: [{ serviceVisitPoolId: joinId, ...readings }],
          chemicalsAdded: [],
          serviceVisitPools,
        }),
      },
    };
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    const result = await completeVisit(visitId, emptyBodies);

    expect(result.bodies[0].recommendations).toEqual([]); // ideal readings
    expect(result.bodies[0].waterHealth.score).toBe(100);
    expect(result.bodies[0].waterHealth.status).toBe("EXCELLENT");
  });

  it("auto-schedules a DRAFT next visit inheriting the tech when nextServiceDate is set and none is upcoming", async () => {
    const existingVisit = {
      id: visitId,
      techId,
      pool: { ...mockPool, volume: 10_000 },
      serviceVisitPools,
    };
    prismaMock.serviceVisit.findUnique.mockResolvedValue(existingVisit);

    const nextServiceDate = new Date("2026-08-15T12:00:00");
    const txMock = {
      waterReading: {
        deleteMany: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
      chemicalAdded: {
        deleteMany: vi.fn().mockResolvedValue({}),
        createMany: vi.fn(),
      },
      serviceVisit: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: visitId,
          status: "COMPLETED",
          version: 1,
          techId,
          pool: mockPool,
          tech: mockTech,
          waterReadings: [{ serviceVisitPoolId: joinId, ...readings }],
          chemicalsAdded: [],
          serviceVisitPools,
        }),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    await completeVisit(visitId, emptyBodies, null, nextServiceDate);

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
      serviceVisitPools,
    };
    prismaMock.serviceVisit.findUnique.mockResolvedValue(existingVisit);

    const txMock = {
      waterReading: {
        deleteMany: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
      chemicalAdded: {
        deleteMany: vi.fn().mockResolvedValue({}),
        createMany: vi.fn(),
      },
      serviceVisit: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: visitId,
          status: "COMPLETED",
          version: 1,
          pool: mockPool,
          tech: mockTech,
          waterReadings: [{ serviceVisitPoolId: joinId, ...readings }],
          chemicalsAdded: [],
          serviceVisitPools,
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
      emptyBodies,
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
      serviceVisitPools,
    };
    prismaMock.serviceVisit.findUnique.mockResolvedValue(existingVisit);

    const txMock = {
      waterReading: {
        deleteMany: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
      chemicalAdded: {
        deleteMany: vi.fn().mockResolvedValue({}),
        createMany: vi.fn(),
      },
      serviceVisit: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: visitId,
          status: "COMPLETED",
          version: 1,
          pool: mockPool,
          tech: mockTech,
          waterReadings: [{ serviceVisitPoolId: joinId, ...readings }],
          chemicalsAdded: [],
          serviceVisitPools,
        }),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    };
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    await completeVisit(visitId, emptyBodies);

    expect(txMock.serviceVisit.findFirst).not.toHaveBeenCalled();
    expect(txMock.serviceVisit.create).not.toHaveBeenCalled();
  });

  it("replays an already-applied clientMutationId as a no-op", async () => {
    const appliedVisit = {
      id: visitId,
      status: "COMPLETED",
      version: 1,
      clientMutationId: "mut-1",
      reportNotifiedAt: new Date("2026-08-01T12:00:00"),
      techId,
      pool: { ...mockPool, volume: 10_000 },
      tech: mockTech,
      waterReadings: [{ serviceVisitPoolId: joinId, ...readings }],
      chemicalsAdded: chemicals,
      serviceVisitPools,
    };
    prismaMock.serviceVisit.findUnique.mockResolvedValue(appliedVisit);

    const result = await completeVisit(
      visitId,
      bodies,
      null,
      new Date("2026-08-15T12:00:00"),
      { clientMutationId: "mut-1" },
    );

    expect(result.applied).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(result.visit).toEqual(appliedVisit);
  });

  it("rejects with VisitVersionConflictError when the visit's version is stale", async () => {
    prismaMock.serviceVisit.findUnique.mockResolvedValue({
      id: visitId,
      status: "IN_PROGRESS",
      version: 3,
      pool: { ...mockPool, volume: 10_000 },
      serviceVisitPools,
    });

    await expect(
      completeVisit(visitId, bodies, null, null, {
        expectedVersion: 2,
      }),
    ).rejects.toThrow(VisitVersionConflictError);
    // A rejected guard must not run the write transaction.
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects atomically when a concurrent write bumps the version after the pre-check", async () => {
    // The pre-check passes (stored version still matches), but the conditional
    // write inside the transaction matches nothing — a concurrent completion
    // won the race between our read and our write. The guard must catch it
    // inside the transaction, not only before it.
    prismaMock.serviceVisit.findUnique.mockResolvedValue({
      id: visitId,
      status: "IN_PROGRESS",
      version: 2,
      techId,
      pool: { ...mockPool, volume: 10_000 },
      serviceVisitPools,
    });

    const txMock = {
      waterReading: {
        deleteMany: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
      },
      chemicalAdded: {
        deleteMany: vi.fn().mockResolvedValue({}),
        createMany: vi.fn(),
      },
      serviceVisit: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn(),
      },
    };
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    await expect(
      completeVisit(visitId, emptyBodies, null, null, {
        expectedVersion: 2,
      }),
    ).rejects.toThrow(VisitVersionConflictError);
    expect(txMock.serviceVisit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: visitId, version: 2 },
      }),
    );
    // A conflicting write must not proceed to the re-read or next-visit
    // scheduling.
    expect(txMock.serviceVisit.findUnique).not.toHaveBeenCalled();
  });

  it("does not throw when expectedVersion is omitted, even with a stored version", async () => {
    prismaMock.serviceVisit.findUnique.mockResolvedValue({
      id: visitId,
      status: "IN_PROGRESS",
      version: 3,
      techId,
      pool: { ...mockPool, volume: 10_000 },
      serviceVisitPools,
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
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: visitId,
          status: "COMPLETED",
          version: 4,
          pool: mockPool,
          tech: mockTech,
          waterReadings: [{ serviceVisitPoolId: joinId, ...readings }],
          chemicalsAdded: [],
          serviceVisitPools,
        }),
      },
    };
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    const result = await completeVisit(visitId, emptyBodies);

    expect(result.applied).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it("lets the replay-dedupe win over the version guard", async () => {
    // Same clientMutationId already applied, but the caller's expectedVersion
    // is stale — an already-applied replay must stay idempotent regardless of
    // drift, so the guard is bypassed and no conflict is thrown.
    prismaMock.serviceVisit.findUnique.mockResolvedValue({
      id: visitId,
      status: "COMPLETED",
      version: 5,
      clientMutationId: "mut-replay",
      pool: { ...mockPool, volume: 10_000 },
      tech: mockTech,
      waterReadings: [{ serviceVisitPoolId: joinId, ...readings }],
      chemicalsAdded: [],
      serviceVisitPools,
    });

    const result = await completeVisit(
      visitId,
      bodies,
      null,
      null,
      { clientMutationId: "mut-replay", expectedVersion: 2 },
    );

    expect(result.applied).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("returns the bumped version on the completed visit", async () => {
    prismaMock.serviceVisit.findUnique.mockResolvedValue({
      id: visitId,
      status: "IN_PROGRESS",
      version: 0,
      techId,
      pool: { ...mockPool, volume: 10_000 },
      serviceVisitPools,
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
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: visitId,
          status: "COMPLETED",
          version: 1,
          pool: mockPool,
          tech: mockTech,
          waterReadings: [{ serviceVisitPoolId: joinId, ...readings }],
          chemicalsAdded: [],
          serviceVisitPools,
        }),
      },
    };
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    const result = await completeVisit(visitId, emptyBodies, null, null, {
      expectedVersion: 0,
    });

    expect(result.applied).toBe(true);
    expect(result.visit?.version).toBe(1);
    expect(txMock.serviceVisit.updateMany).toHaveBeenCalledWith({
      where: { id: visitId, version: 0 },
      data: expect.objectContaining({
        version: { increment: 1 },
      }),
    });
  });

  it("applies a new clientMutationId, bumps version and stores the key", async () => {
    prismaMock.serviceVisit.findUnique.mockResolvedValue({
      id: visitId,
      techId,
      clientMutationId: null,
      version: 0,
      pool: { ...mockPool, volume: 10_000 },
      serviceVisitPools,
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
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: visitId,
          status: "COMPLETED",
          version: 1,
          clientMutationId: "mut-2",
          pool: mockPool,
          tech: mockTech,
          waterReadings: [{ serviceVisitPoolId: joinId, ...readings }],
          chemicalsAdded: [],
          serviceVisitPools,
        }),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    const result = await completeVisit(
      visitId,
      emptyBodies,
      null,
      null,
      { clientMutationId: "mut-2" },
    );

    expect(result.applied).toBe(true);
    expect(txMock.serviceVisit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: visitId },
        data: expect.objectContaining({
          version: { increment: 1 },
          clientMutationId: "mut-2",
        }),
      }),
    );
  });

  it("returns the winner's state when a concurrent replay hits the unique key", async () => {
    prismaMock.serviceVisit.findUnique
      .mockResolvedValueOnce({
        id: visitId,
        techId,
        pool: { ...mockPool, volume: 10_000 },
        serviceVisitPools,
      })
      .mockResolvedValueOnce({
        id: visitId,
        status: "COMPLETED",
        version: 1,
        clientMutationId: "mut-3",
        pool: mockPool,
        tech: mockTech,
        waterReadings: [{ serviceVisitPoolId: joinId, ...readings }],
        chemicalsAdded: [],
        serviceVisitPools,
      });
    const error = new Prisma.PrismaClientKnownRequestError("Unique constraint", {
      code: "P2002",
      clientVersion: "7",
    });
    prismaMock.$transaction.mockRejectedValue(error);

    const result = await completeVisit(
      visitId,
      emptyBodies,
      null,
      null,
      { clientMutationId: "mut-3" },
    );

    expect(result.applied).toBe(false);
    expect(result.visit!.clientMutationId).toBe("mut-3");
  });

  it("does not write reportNotifiedAt in the completion tx", async () => {
    const firstNotifiedAt = new Date("2026-08-01T12:00:00");
    prismaMock.serviceVisit.findUnique.mockResolvedValue({
      id: visitId,
      techId,
      reportNotifiedAt: firstNotifiedAt,
      pool: { ...mockPool, volume: 10_000 },
      serviceVisitPools,
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
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: visitId,
          status: "COMPLETED",
          reportNotifiedAt: firstNotifiedAt,
          pool: mockPool,
          tech: mockTech,
          waterReadings: [{ serviceVisitPoolId: joinId, ...readings }],
          chemicalsAdded: [],
          serviceVisitPools,
        }),
      },
    };
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    const result = await completeVisit(visitId, emptyBodies);

    expect(result.visit!.reportNotifiedAt).toBe(firstNotifiedAt);
    expect(txMock.serviceVisit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          reportNotifiedAt: expect.anything(),
        }),
      }),
    );
  });
});

describe("claimReportNotification", () => {
  it("returns true and stamps the slot when it is still null", async () => {
    prismaMock.serviceVisit.updateMany.mockResolvedValue({ count: 1 });

    const won = await claimReportNotification(visitId, companyId);

    expect(won).toBe(true);
    expect(prismaMock.serviceVisit.updateMany).toHaveBeenCalledWith({
      where: { id: visitId, pool: { companyId }, reportNotifiedAt: null },
      data: { reportNotifiedAt: expect.any(Date) },
    });
  });

  it("returns false when a concurrent retry already claimed the slot", async () => {
    prismaMock.serviceVisit.updateMany.mockResolvedValue({ count: 0 });

    const won = await claimReportNotification(visitId, companyId);

    expect(won).toBe(false);
  });
});

describe("releaseReportNotification", () => {
  it("clears the claim so a later retry re-sends", async () => {
    prismaMock.serviceVisit.updateMany.mockResolvedValue({ count: 1 });

    await releaseReportNotification(visitId, companyId);

    expect(prismaMock.serviceVisit.updateMany).toHaveBeenCalledWith({
      where: { id: visitId, pool: { companyId } },
      data: { reportNotifiedAt: null },
    });
  });
});

describe("saveDraftVisit", () => {
  const joinId = "join-1";
  const readings = {
    ph: 7.4,
    freeChlorine: 1,
    totalAlkalinity: 80,
    calciumHardness: 200,
    cyanuricAcid: 30,
    temperature: 75,
  };

  const emptyBodies = [{ serviceVisitPoolId: joinId, readings, chemicals: [] }];

  /** One join row per body — required by `assertBodiesCoverVisit`. */
  const serviceVisitPools = [{ id: joinId, pool: { ...mockPool, volume: 10_000 } }];

  it("throws when visit is not found", async () => {
    prismaMock.serviceVisit.findUnique.mockResolvedValue(null);

    await expect(
      saveDraftVisit(visitId, emptyBodies),
    ).rejects.toThrow(/not found/i);
  });

  it("replaces readings and chemicals in a transaction", async () => {
    prismaMock.serviceVisit.findUnique.mockResolvedValue({
      id: visitId,
      status: "DRAFT",
      serviceVisitPools,
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
          waterReadings: [{ serviceVisitPoolId: joinId, ...readings }],
          chemicalsAdded: [],
          serviceVisitPools,
        }),
      },
    };
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    await saveDraftVisit(visitId, emptyBodies, "Draft notes");

    expect(txMock.waterReading.deleteMany).toHaveBeenCalledWith({
      where: { visitId },
    });
    expect(txMock.waterReading.create).toHaveBeenCalledWith({
      data: { visitId, serviceVisitPoolId: joinId, ...readings },
    });
    expect(txMock.chemicalAdded.deleteMany).toHaveBeenCalledWith({
      where: { visitId },
    });
    expect(txMock.serviceVisit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: visitId },
        data: expect.objectContaining({
          notes: "Draft notes",
          version: { increment: 1 },
        }),
      }),
    );
  });

  it("replays an already-applied clientMutationId as a no-op", async () => {
    prismaMock.serviceVisit.findUnique.mockResolvedValue({
      id: visitId,
      status: "DRAFT",
      version: 1,
      clientMutationId: "mut-1",
      pool: mockPool,
      tech: mockTech,
      waterReadings: [{ serviceVisitPoolId: joinId, ...readings }],
      chemicalsAdded: [],
      serviceVisitPools,
    });

    const result = await saveDraftVisit(
      visitId,
      emptyBodies,
      null,
      null,
      { clientMutationId: "mut-1" },
    );

    expect(result.applied).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("applies a new clientMutationId, bumps version and stores the key", async () => {
    prismaMock.serviceVisit.findUnique.mockResolvedValue({
      id: visitId,
      status: "DRAFT",
      clientMutationId: null,
      version: 0,
      serviceVisitPools,
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
          version: 1,
          clientMutationId: "mut-2",
          serviceVisitPools,
        }),
      },
    };
    prismaMock.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );

    const result = await saveDraftVisit(
      visitId,
      emptyBodies,
      null,
      null,
      { clientMutationId: "mut-2" },
    );

    expect(result.applied).toBe(true);
    expect(txMock.serviceVisit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: { increment: 1 },
          clientMutationId: "mut-2",
        }),
      }),
    );
  });

  it("throws when the visit is already COMPLETED", async () => {
    prismaMock.serviceVisit.findUnique.mockResolvedValue({
      id: visitId,
      status: "COMPLETED",
    });

    await expect(saveDraftVisit(visitId, emptyBodies)).rejects.toThrow(
      /completed or cancelled/i,
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("throws when the visit is already CANCELLED", async () => {
    prismaMock.serviceVisit.findUnique.mockResolvedValue({
      id: visitId,
      status: "CANCELLED",
    });

    await expect(saveDraftVisit(visitId, emptyBodies)).rejects.toThrow(
      /completed or cancelled/i,
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
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
      data: { status: "IN_PROGRESS", techId, version: { increment: 1 } },
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
      data: { status: "IN_PROGRESS", techId, version: { increment: 1 } },
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
      data: { status: "COMPLETED", version: { increment: 1 } },
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
      data: {
        status: "CANCELLED",
        cancellationReason: "Client requested",
        version: { increment: 1 },
      },
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
      data: { scheduledAt: newDate, techId, version: { increment: 1 } },
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
      data: { techId: null, version: { increment: 1 } },
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
