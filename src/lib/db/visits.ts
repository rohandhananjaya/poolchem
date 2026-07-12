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
import { ServiceVisitStatus } from "@/generated/prisma/client";

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
 * Returns the company's visits for today — those scheduled for today or created
 * ad-hoc today (the day's route) — with their pool and servicing tech attached.
 * Ordered by scheduled time (null last), then creation time.
 */
export async function getTodayVisits(companyId: string) {
  const { gte, lt } = todayRange();
  return prisma.serviceVisit.findMany({
    where: {
      pool: { companyId },
      status: { not: ServiceVisitStatus.CANCELLED },
      OR: [
        { scheduledAt: { gte, lt } },
        { scheduledAt: null, createdAt: { gte, lt } },
      ],
    },
    orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
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
 * Starts a new DRAFT visit for a pool. When `techId` is provided, verifies the
 * tech belongs to `companyId` before creating. Passing `null` creates an
 * unassigned visit (any tech can pick it up).
 *
 * @param scheduledAt - When the visit is planned for. Omit for ad-hoc visits
 *   (e.g. a tech scanning a pool in the field), which have no scheduled time.
 * @throws {Error} If the pool is not found, or if a `techId` is given but does
 *   not belong to the company.
 */
export async function createVisit(
  poolId: string,
  techId: string | null,
  companyId: string,
  scheduledAt?: Date,
) {
  const pool = await prisma.pool.findFirst({ where: { id: poolId, companyId } });
  if (!pool) {
    throw new Error(`Pool "${poolId}" not found for company "${companyId}".`);
  }

  if (techId) {
    const tech = await prisma.user.findFirst({ where: { id: techId, companyId } });
    if (!tech) {
      throw new Error(`Tech "${techId}" not found for company "${companyId}".`);
    }
  }

  return prisma.serviceVisit.create({
    data: {
      status: ServiceVisitStatus.DRAFT,
      scheduledAt: scheduledAt ?? null,
      poolId: poolId,
      techId: techId,
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
        status: ServiceVisitStatus.COMPLETED,
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
    where: { poolId, status: ServiceVisitStatus.COMPLETED },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { waterReadings: true, chemicalsAdded: true, tech: true },
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
 * Marks a visit as IN_PROGRESS. Only visits in DRAFT status can be started.
 * When a tech starts a visit they become the assigned tech (`techId`).
 * Scoped to `companyId` via the pool relation.
 *
 * @returns The updated visit, or `null` if not found or not scoped.
 */
export async function startVisit(
  visitId: string,
  companyId: string,
  techId?: string | null,
) {
  const visit = await prisma.serviceVisit.findFirst({
    where: { id: visitId, pool: { companyId }, status: ServiceVisitStatus.DRAFT },
  });
  if (!visit) return null;

  return prisma.serviceVisit.update({
    where: { id: visitId },
    data: {
      status: ServiceVisitStatus.IN_PROGRESS,
      techId: techId ?? visit.techId,
    },
  });
}

/**
 * Asserts the current user is allowed to modify a visit. For IN_PROGRESS
 * visits the user must be the assigned tech. Throws on violation.
 *
 * @returns The visit's status for callers to branch on.
 */
export async function assertVisitAccess(
  visitId: string,
  companyId: string,
  userId: string,
): Promise<ServiceVisitStatus> {
  const visit = await prisma.serviceVisit.findFirst({
    where: { id: visitId, pool: { companyId } },
    select: { status: true, techId: true },
  });
  if (!visit) throw new Error("Visit not found.");

  if (
    visit.status === ServiceVisitStatus.IN_PROGRESS &&
    visit.techId &&
    visit.techId !== userId
  ) {
    throw new Error("This visit is in progress by another tech.");
  }

  return visit.status;
}

/**
 * Updates the status of a visit. Only DRAFT → IN_PROGRESS → COMPLETED and
 * any status → CANCELLED transitions are permitted. Scoped to `companyId`
 * via the pool relation.
 *
 * @returns The updated visit, or `null` if not found or not scoped.
 */
export async function updateVisitStatus(
  visitId: string,
  companyId: string,
  status: ServiceVisitStatus,
) {
  const visit = await prisma.serviceVisit.findFirst({
    where: { id: visitId, pool: { companyId } },
  });
  if (!visit) return null;

  return prisma.serviceVisit.update({
    where: { id: visitId },
    data: { status },
  });
}

/**
 * Cancels a visit: sets its status to CANCELLED and stores the cancellation
 * reason. Only visits belonging to `companyId` (via the pool relation) can be
 * cancelled.
 *
 * @returns The updated visit, or `null` if the visit was not found or is not
 *   scoped to this company.
 */
export async function cancelVisit(
  visitId: string,
  companyId: string,
  reason: string,
) {
  const visit = await prisma.serviceVisit.findFirst({
    where: { id: visitId, pool: { companyId } },
  });
  if (!visit) return null;

  return prisma.serviceVisit.update({
    where: { id: visitId },
    data: { status: ServiceVisitStatus.CANCELLED, cancellationReason: reason },
  });
}

/**
 * Updates the scheduled date and/or assigned tech for a visit. Verifies the
 * visit belongs to `companyId` (via its pool). When `techId` is provided, it
 * must also belong to `companyId`.
 *
 * @returns The updated visit, or `null` if the visit was not found.
 * @throws {Error} If the given `techId` does not belong to the company.
 */
export async function updateVisit(
  visitId: string,
  companyId: string,
  data: { scheduledAt?: Date | null; techId?: string | null },
) {
  const visit = await prisma.serviceVisit.findFirst({
    where: { id: visitId, pool: { companyId } },
    include: { pool: true },
  });
  if (!visit) return null;

  if (data.techId) {
    const tech = await prisma.user.findFirst({
      where: { id: data.techId, companyId },
    });
    if (!tech) {
      throw new Error(`Tech "${data.techId}" not found for company "${companyId}".`);
    }
  }

  return prisma.serviceVisit.update({
    where: { id: visitId },
    data: {
      scheduledAt: data.scheduledAt !== undefined ? data.scheduledAt : undefined,
      techId: data.techId !== undefined ? data.techId : undefined,
    },
  });
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
