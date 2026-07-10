/**
 * Data access for {@link ServiceVisit} records and their child readings and
 * chemical additions.
 *
 * A ServiceVisit carries no `companyId` of its own — it is scoped to a tenant
 * through its pool (`visit.pool.companyId`). All company-scoped helpers filter
 * on that relation so a visit can never leak across tenants.
 */
import "server-only";

import {
  getChemicalRecommendations,
  getWaterHealthScore,
  type ChemicalRecommendation,
  type WaterHealthResult,
  type WaterReadingInput,
} from "@/lib/pool-chemistry";
import { prisma } from "@/lib/prisma";

/** A full set of water-test readings recorded during a visit. */
export interface VisitReadings extends Omit<WaterReadingInput, "temperature"> {
  /** Water temperature in °F (required when persisting a reading). */
  temperature: number;
}

/** A single chemical the tech added during a visit. */
export interface VisitChemical {
  name: string;
  amount: number;
  unit: string;
}

/** Local midnight-to-midnight window for "today". */
function todayRange(): { gte: Date; lt: Date } {
  const now = new Date();
  const gte = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lt = new Date(gte);
  lt.setDate(lt.getDate() + 1);
  return { gte, lt };
}

/**
 * Returns the company's visits created today (the day's route), with their pool
 * and servicing tech attached. Ordered oldest-first.
 */
export async function getTodayVisits(companyId: string) {
  const { gte, lt } = todayRange();
  return prisma.serviceVisit.findMany({
    where: { pool: { companyId }, createdAt: { gte, lt } },
    orderBy: { createdAt: "asc" },
    include: { pool: true, tech: true },
  });
}

/**
 * Returns a single visit with its readings, chemicals, pool and tech — but only
 * if the visit's pool belongs to `companyId`. Returns `null` otherwise.
 */
export async function getVisitById(visitId: string, companyId: string) {
  return prisma.serviceVisit.findFirst({
    where: { id: visitId, pool: { companyId } },
    include: {
      pool: true,
      tech: true,
      waterReadings: true,
      chemicalsAdded: true,
    },
  });
}

/**
 * Starts a new DRAFT visit for a pool, verifying that both the pool and the tech
 * belong to `companyId` before creating anything.
 *
 * @throws {Error} If the pool or tech is not found within the company.
 */
export async function createVisit(
  poolId: string,
  techId: string,
  companyId: string,
) {
  const [pool, tech] = await Promise.all([
    prisma.pool.findFirst({ where: { id: poolId, companyId } }),
    prisma.user.findFirst({ where: { id: techId, companyId } }),
  ]);

  if (!pool) {
    throw new Error(`Pool "${poolId}" not found for company "${companyId}".`);
  }
  if (!tech) {
    throw new Error(`Tech "${techId}" not found for company "${companyId}".`);
  }

  return prisma.serviceVisit.create({
    data: {
      status: "DRAFT",
      pool: { connect: { id: poolId } },
      tech: { connect: { id: techId } },
    },
  });
}

/** The completed visit plus the chemistry engine's derived output. */
export interface CompletedVisit {
  visit: Awaited<ReturnType<typeof getVisitById>>;
  /** Doses recommended to correct the water, computed from the readings. */
  recommendations: ChemicalRecommendation[];
  /** Overall water-health assessment for the recorded readings. */
  waterHealth: WaterHealthResult;
}

/**
 * Completes a visit: persists its water readings and chemical additions, marks
 * it COMPLETED, then computes (but does not persist) chemical recommendations
 * and a water-health score from the readings for the caller to display.
 *
 * The write is transactional — readings, chemicals and the status change all
 * commit together or not at all.
 *
 * @throws {Error} If the visit does not exist.
 */
export async function completeVisit(
  visitId: string,
  readings: VisitReadings,
  chemicals: VisitChemical[],
  notes?: string | null,
): Promise<CompletedVisit> {
  const existing = await prisma.serviceVisit.findUnique({
    where: { id: visitId },
    include: { pool: true },
  });

  if (!existing) {
    throw new Error(`Visit "${visitId}" not found.`);
  }

  const visit = await prisma.$transaction(async (tx) => {
    await tx.waterReading.create({ data: { visitId, ...readings } });

    if (chemicals.length > 0) {
      await tx.chemicalAdded.createMany({
        data: chemicals.map((chemical) => ({ visitId, ...chemical })),
      });
    }

    return tx.serviceVisit.update({
      where: { id: visitId },
      data: {
        status: "COMPLETED",
        // Leave existing notes untouched when none are supplied.
        notes: notes ?? undefined,
      },
      include: {
        pool: true,
        tech: true,
        waterReadings: true,
        chemicalsAdded: true,
      },
    });
  });

  return {
    visit,
    recommendations: getChemicalRecommendations(readings, existing.pool.volume),
    waterHealth: getWaterHealthScore(readings),
  };
}

/**
 * Returns a pool's most recent completed visits (newest first), with readings
 * and chemicals attached — the data source for trend charts.
 *
 * @param limit - Maximum number of visits to return.
 */
export async function getVisitHistory(poolId: string, limit: number) {
  return prisma.serviceVisit.findMany({
    where: { poolId, status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { waterReadings: true, chemicalsAdded: true },
  });
}

/**
 * Returns the water readings from the most recent completed visit for a pool,
 * or `null` if no completed visits exist yet.
 */
export async function getLastVisitReadings(
  poolId: string,
): Promise<VisitReadings | null> {
  const history = await getVisitHistory(poolId, 1);
  const last = history[0]?.waterReadings[0];
  if (!last) return null;
  return {
    ph: last.ph,
    freeChlorine: last.freeChlorine,
    totalAlkalinity: last.totalAlkalinity,
    calciumHardness: last.calciumHardness,
    cyanuricAcid: last.cyanuricAcid,
    temperature: last.temperature,
  };
}

/**
 * Saves a draft visit: persists (replaces) water readings and chemicals, updates
 * notes, but keeps the visit status as DRAFT.
 *
 * Uses a transaction so that readings, chemicals, and notes all update together.
 *
 * @throws {Error} If the visit does not exist.
 */
export async function saveDraftVisit(
  visitId: string,
  readings: VisitReadings,
  chemicals: VisitChemical[],
  notes?: string | null,
) {
  const existing = await prisma.serviceVisit.findUnique({
    where: { id: visitId },
  });

  if (!existing) {
    throw new Error(`Visit "${visitId}" not found.`);
  }

  const visit = await prisma.$transaction(async (tx) => {
    await tx.waterReading.deleteMany({ where: { visitId } });
    await tx.waterReading.create({ data: { visitId, ...readings } });

    await tx.chemicalAdded.deleteMany({ where: { visitId } });
    if (chemicals.length > 0) {
      await tx.chemicalAdded.createMany({
        data: chemicals.map((c) => ({ visitId, ...c })),
      });
    }

    return tx.serviceVisit.update({
      where: { id: visitId },
      data: { notes: notes ?? undefined },
      include: {
        pool: true,
        tech: true,
        waterReadings: true,
        chemicalsAdded: true,
      },
    });
  });

  return visit;
}
