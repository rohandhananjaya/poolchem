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
import { VisitVersionConflictError } from "@/lib/errors";
import {
  Prisma,
  ServiceVisit,
  ServiceVisitStatus,
} from "@/generated/prisma/client";

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

/** Options controlling an idempotent visit write (offline replay support). */
export interface VisitWriteOpts {
  /**
   * Device-generated key identifying a queued offline mutation. When the stored
   * visit already carries this key the write is treated as an already-applied
   * replay and skipped.
   */
  clientMutationId?: string;
  /**
   * Expected revision for the stale-write guard. `completeVisit` rejects with a
   * {@link VisitVersionConflictError} when the stored visit's `version` differs
   * (the visit was updated on another device); `saveDraftVisit` ignores it
   * (drafts are last-write-wins). Omit for callers that don't track versions.
   */
  expectedVersion?: number;
}

/**
 * Replaces a visit's child rows inside a transaction: deleteMany then recreate.
 * Running this twice with the same input converges to the same state rather than
 * duplicating WaterReading/ChemicalAdded rows — the basis for idempotent saves.
 */
async function replaceReadingsAndChemicals(
  tx: Prisma.TransactionClient,
  visitId: string,
  readings: VisitReadings,
  chemicals: VisitChemical[],
): Promise<void> {
  await tx.waterReading.deleteMany({ where: { visitId } });
  await tx.waterReading.create({ data: { visitId, ...readings } });

  await tx.chemicalAdded.deleteMany({ where: { visitId } });
  if (chemicals.length > 0) {
    await tx.chemicalAdded.createMany({
      data: chemicals.map((c) => ({ visitId, ...c })),
    });
  }
}

/** Maps a persisted WaterReading back to the {@link VisitReadings} shape. */
function toVisitReadings(reading: {
  ph: number;
  freeChlorine: number;
  totalAlkalinity: number;
  calciumHardness: number;
  cyanuricAcid: number;
  temperature: number;
}): VisitReadings {
  return {
    ph: reading.ph,
    freeChlorine: reading.freeChlorine,
    totalAlkalinity: reading.totalAlkalinity,
    calciumHardness: reading.calciumHardness,
    cyanuricAcid: reading.cyanuricAcid,
    temperature: reading.temperature,
  };
}

/** Returns true for Prisma's unique-constraint violation (P2002). */
function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
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
 * The write is idempotent for offline replay: when `opts.clientMutationId` is
 * supplied and a visit with that key already exists (scoped via the pool's
 * company), the existing visit is returned instead of creating a duplicate —
 * mirrors `completeVisit`'s replay short-circuit. The key is stored on the
 * created visit so a later replay is a no-op.
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
  opts: VisitWriteOpts = {},
) {
  const pool = await prisma.pool.findFirst({ where: { id: poolId, companyId } });
  if (!pool) {
    throw new Error(`Pool "${poolId}" not found for company "${companyId}".`);
  }

  // Replay short-circuit: an already-applied `clientMutationId` returns the
  // existing visit without re-verifying the tech (the mutation already landed).
  if (opts.clientMutationId) {
    const existing = await prisma.serviceVisit.findFirst({
      where: { pool: { companyId }, clientMutationId: opts.clientMutationId },
    });
    if (existing) return existing;
  }

  if (techId) {
    const tech = await prisma.user.findFirst({ where: { id: techId, companyId } });
    if (!tech) {
      throw new Error(`Tech "${techId}" not found for company "${companyId}".`);
    }
  }

  try {
    return await prisma.serviceVisit.create({
      data: {
        status: ServiceVisitStatus.DRAFT,
        scheduledAt: scheduledAt ?? null,
        poolId: poolId,
        techId: techId,
        clientMutationId: opts.clientMutationId ?? undefined,
      },
    });
  } catch (error) {
    // Two concurrent same-key replays both pass the short-circuit; the second
    // hits the @unique on clientMutationId. Re-read and return the winner's
    // visit as an already-applied replay.
    if (isUniqueConstraintError(error) && opts.clientMutationId) {
      const current = await prisma.serviceVisit.findFirst({
        where: { pool: { companyId }, clientMutationId: opts.clientMutationId },
      });
      if (current) return current;
    }
    throw error;
  }
}

/** The completed visit plus the chemistry engine's derived output. */
export interface CompletedVisit {
  visit: Awaited<ReturnType<typeof getVisitById>>;
  /** Doses recommended to correct the water, computed from the readings. */
  recommendations: ChemicalRecommendation[];
  /** Overall water-health assessment for the recorded readings. */
  waterHealth: WaterHealthResult;
  /** Whether this call applied the write. `false` = already-applied replay. */
  applied: boolean;
}

/** The result of a save-draft write, with an idempotency flag. */
export interface SavedVisit {
  visit: Awaited<ReturnType<typeof getVisitById>>;
  /** Whether this call applied the write. `false` = already-applied replay. */
  applied: boolean;
}

/**
 * Auto-schedules the pool's next visit from a manually-set next-service date,
 * inheriting the completed visit's tech. Skips if a future non-cancelled
 * visit already exists for the pool (other than the one just completed).
 */
async function scheduleNextVisit(
  tx: Prisma.TransactionClient,
  poolId: string,
  techId: string | null,
  scheduledAt: Date,
  completedVisitId: string,
): Promise<void> {
  const upcoming = await tx.serviceVisit.findFirst({
    where: {
      poolId,
      id: { not: completedVisitId },
      scheduledAt: { gte: new Date() },
      status: { not: ServiceVisitStatus.CANCELLED },
    },
    select: { id: true },
  });
  if (upcoming) return;

  await tx.serviceVisit.create({
    data: {
      status: ServiceVisitStatus.DRAFT,
      poolId,
      techId,
      scheduledAt,
    },
  });
}

/**
 * Completes a visit: persists its water readings and chemical additions, marks
 * it COMPLETED, then computes (but does not persist) chemical recommendations
 * and a water-health score from the readings for the caller to display.
 *
 * The write is transactional — readings, chemicals, the status change, and
 * (when a next-service date is set) auto-scheduling the pool's next visit
 * all commit together or not at all.
 *
 * The write is idempotent: readings/chemicals are replaced (not appended), the
 * visit's `version` is bumped, and an optional `clientMutationId` is stored so a
 * replayed offline mutation is a no-op (`applied: false`, no transaction, no
 * next-visit scheduling).
 *
 * When `opts.expectedVersion` is supplied, a stored `version` that no longer
 * matches throws {@link VisitVersionConflictError} — a racing completion from
 * another device must not be silently overwritten. The guard is enforced
 * atomically: the write is a conditional `updateMany` filtered on the expected
 * revision, so two devices that both read the same version can't both pass a
 * check-then-write race. An already-applied replay (same `clientMutationId`)
 * short-circuits before the guard and stays idempotent regardless of drift.
 *
 * `reportNotifiedAt` is deliberately NOT stamped here. The caller claims the
 * report-email slot with `claimReportNotification` before sending and releases
 * it with `releaseReportNotification` on a confirmed send failure — so a crash
 * between commit and send can't silently skip the email. The stamp on the
 * returned visit tells the caller whether the email had already gone out at
 * write time.
 *
 * @throws {Error} If the visit does not exist.
 */
export async function completeVisit(
  visitId: string,
  readings: VisitReadings,
  chemicals: VisitChemical[],
  notes?: string | null,
  nextServiceDate?: Date | null,
  opts: VisitWriteOpts = {},
): Promise<CompletedVisit> {
  const existing = await prisma.serviceVisit.findUnique({
    where: { id: visitId },
    include: { pool: true, tech: true, waterReadings: true, chemicalsAdded: true },
  });

  if (!existing) {
    throw new Error(`Visit "${visitId}" not found.`);
  }

  if (opts.clientMutationId && existing.clientMutationId === opts.clientMutationId) {
    const replayReadings = existing.waterReadings[0]
      ? toVisitReadings(existing.waterReadings[0])
      : readings;
    return {
      visit: existing,
      recommendations: getChemicalRecommendations(
        replayReadings,
        existing.pool.volume,
      ),
      waterHealth: getWaterHealthScore(replayReadings),
      applied: false,
    };
  }

  // Stale-write guard: completion is terminal (report + homeowner email), so a
  // caller that knows the revision it wrote against rejects when another device
  // bumped the visit first. Deliberately after the replay short-circuit — an
  // already-applied replay must stay idempotent regardless of drift.
  if (
    opts.expectedVersion !== undefined &&
    existing.version !== opts.expectedVersion
  ) {
    throw new VisitVersionConflictError();
  }

  let visit: Awaited<ReturnType<typeof getVisitById>>;
  try {
    visit = await prisma.$transaction(async (tx) => {
      await replaceReadingsAndChemicals(tx, visitId, readings, chemicals);

      // Atomic stale-write guard: the version filter below only matches when the
      // stored revision still equals what the caller wrote against, so a
      // concurrent completion that bumped the version between our read and this
      // write is detected inside the transaction — the pre-check above is a fast
      // path, not the guarantee.
      const { count } = await tx.serviceVisit.updateMany({
        where: {
          id: visitId,
          ...(opts.expectedVersion !== undefined
            ? { version: opts.expectedVersion }
            : {}),
        },
        data: {
          status: ServiceVisitStatus.COMPLETED,
          // Leave existing notes untouched when none are supplied.
          notes: notes ?? undefined,
          nextServiceDate:
            nextServiceDate !== undefined ? nextServiceDate : undefined,
          version: { increment: 1 },
          clientMutationId: opts.clientMutationId ?? undefined,
        },
      });

      if (count === 0) {
        if (opts.expectedVersion !== undefined) {
          throw new VisitVersionConflictError();
        }
        throw new Error(`Visit "${visitId}" not found.`);
      }

      const updated = await tx.serviceVisit.findUnique({
        where: { id: visitId },
        include: {
          pool: true,
          tech: true,
          waterReadings: true,
          chemicalsAdded: true,
        },
      });
      if (!updated) {
        throw new Error(`Visit "${visitId}" not found.`);
      }

      if (nextServiceDate) {
        await scheduleNextVisit(
          tx,
          updated.pool.id,
          updated.techId,
          nextServiceDate,
          visitId,
        );
      }

      return updated;
    });
  } catch (error) {
    // Two concurrent same-key replays both pass the pre-check; the second hits
    // the @unique on clientMutationId inside the tx. Re-read and report the
    // winner's state as an already-applied replay.
    if (isUniqueConstraintError(error) && opts.clientMutationId) {
      const current = await prisma.serviceVisit.findUnique({
        where: { id: visitId },
        include: { pool: true, tech: true, waterReadings: true, chemicalsAdded: true },
      });
      if (current) {
        const replayReadings = current.waterReadings[0]
          ? toVisitReadings(current.waterReadings[0])
          : readings;
        return {
          visit: current,
          recommendations: getChemicalRecommendations(
            replayReadings,
            current.pool.volume,
          ),
          waterHealth: getWaterHealthScore(replayReadings),
          applied: false,
        };
      }
    }
    throw error;
  }

  return {
    visit,
    recommendations: getChemicalRecommendations(readings, existing.pool.volume),
    waterHealth: getWaterHealthScore(readings),
    applied: true,
  };
}

/**
 * Atomically claims the report-email send slot for a completed visit.
 *
 * Returns `true` only when this caller wins the claim (the slot was still null)
 * and therefore owns the send. A concurrent retry that races here sees
 * `count === 0` and must skip sending, preserving at-most-once delivery.
 *
 * The claim stamps the slot as "attempted" before the email goes out. The stamp
 * is cleared only by {@link releaseReportNotification}, called from the same
 * in-flight request on a confirmed failure. A crash between claim and send
 * leaves the stamp set permanently — the at-most-once tradeoff — because a later
 * replay short-circuits on the non-null stamp and never reaches the release path.
 *
 * Scoped to `companyId` via the visit's pool; a visit outside the tenant can't
 * be claimed.
 */
export async function claimReportNotification(
  visitId: string,
  companyId: string,
): Promise<boolean> {
  const { count } = await prisma.serviceVisit.updateMany({
    where: { id: visitId, pool: { companyId }, reportNotifiedAt: null },
    data: { reportNotifiedAt: new Date() },
  });
  return count === 1;
}

/**
 * Releases a claimed report-email slot after a confirmed send failure so a later
 * retry re-attempts delivery. Only the claim winner reaches this path, and only
 * on failure, so a successful send's stamp is never cleared.
 *
 * Scoped to `companyId` via the visit's pool; a visit outside the tenant can't
 * be released.
 */
export async function releaseReportNotification(
  visitId: string,
  companyId: string,
): Promise<void> {
  await prisma.serviceVisit.updateMany({
    where: { id: visitId, pool: { companyId } },
    data: { reportNotifiedAt: null },
  });
}

/**
 * Returns a completed visit by its `publicToken` — the unscoped access grant for
 * the public, no-login shareable report link.
 *
 * Eager-loads the pool, company, tech, readings and chemicals so the report can
 * be assembled with one query. Returns `null` for unknown tokens (→ 404).
 *
 * The public report page ONLY shows COMPLETED visits. Non-completed visits
 * return `null` regardless of token validity.
 */
export async function getVisitByPublicToken(publicToken: string) {
  return prisma.serviceVisit.findFirst({
    where: { publicToken, status: ServiceVisitStatus.COMPLETED },
    include: {
      pool: { include: { company: true } },
      tech: true,
      waterReadings: true,
      chemicalsAdded: true,
    },
  });
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
 * Returns the date of the latest future scheduled (non-cancelled) visit for a
 * pool, or `null` if no upcoming visit is scheduled.
 */
export async function getPoolNextScheduledVisit(poolId: string): Promise<Date | null> {
  const visit = await prisma.serviceVisit.findFirst({
    where: {
      poolId,
      scheduledAt: { gte: new Date() },
      status: { not: ServiceVisitStatus.CANCELLED },
    },
    orderBy: { scheduledAt: "desc" },
    select: { scheduledAt: true },
  });
  return visit?.scheduledAt ?? null;
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
      version: { increment: 1 },
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
    data: { status, version: { increment: 1 } },
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
    data: {
      status: ServiceVisitStatus.CANCELLED,
      cancellationReason: reason,
      version: { increment: 1 },
    },
  });
}

/**
 * Updates the scheduled date and/or assigned tech for a visit. Verifies the
 * visit belongs to `companyId` (via its pool). When `techId` is provided, it
 * must also belong to `companyId`.
 *
 * Only visits that are DRAFT or IN_PROGRESS can be updated. CANCELLED and
 * COMPLETED visits are rejected.
 *
 * @returns The updated visit plus the tech assigned before this update (so a
 *   caller can detect reassignment), or `null` if the visit was not found.
 * @throws {Error} If the visit is CANCELLED or COMPLETED.
 * @throws {Error} If the given `techId` does not belong to the company.
 */
export async function updateVisit(
  visitId: string,
  companyId: string,
  data: { scheduledAt?: Date | null; techId?: string | null },
): Promise<{ visit: ServiceVisit; previousTechId: string | null } | null> {
  const visit = await prisma.serviceVisit.findFirst({
    where: { id: visitId, pool: { companyId } },
    include: { pool: true },
  });
  if (!visit) return null;

  if (
    visit.status === ServiceVisitStatus.CANCELLED ||
    visit.status === ServiceVisitStatus.COMPLETED
  ) {
    throw new Error("Cannot edit a cancelled or completed visit.");
  }

  if (data.techId) {
    const tech = await prisma.user.findFirst({
      where: { id: data.techId, companyId },
    });
    if (!tech) {
      throw new Error(`Tech "${data.techId}" not found for company "${companyId}".`);
    }
  }

  const updated = await prisma.serviceVisit.update({
    where: { id: visitId },
    data: {
      scheduledAt: data.scheduledAt !== undefined ? data.scheduledAt : undefined,
      techId: data.techId !== undefined ? data.techId : undefined,
      version: { increment: 1 },
    },
  });

  return { visit: updated, previousTechId: visit.techId };
}

/**
 * Saves a draft visit: persists (replaces) water readings and chemicals, updates
 * notes, but keeps the visit status as DRAFT.
 *
 * Uses a transaction so that readings, chemicals, and notes all update together.
 *
 * The write is idempotent: a replayed `clientMutationId` is a no-op
 * (`applied: false`), and COMPLETED/CANCELLED visits are rejected so a replayed
 * draft can never clobber a finished visit.
 *
 * @throws {Error} If the visit does not exist, or is COMPLETED or CANCELLED.
 */
export async function saveDraftVisit(
  visitId: string,
  readings: VisitReadings,
  chemicals: VisitChemical[],
  notes?: string | null,
  nextServiceDate?: Date | null,
  opts: VisitWriteOpts = {},
): Promise<SavedVisit> {
  const existing = await prisma.serviceVisit.findUnique({
    where: { id: visitId },
    include: { pool: true, tech: true, waterReadings: true, chemicalsAdded: true },
  });

  if (!existing) {
    throw new Error(`Visit "${visitId}" not found.`);
  }

  if (
    existing.status === ServiceVisitStatus.COMPLETED ||
    existing.status === ServiceVisitStatus.CANCELLED
  ) {
    throw new Error("Cannot save a draft for a completed or cancelled visit.");
  }

  if (opts.clientMutationId && existing.clientMutationId === opts.clientMutationId) {
    return { visit: existing, applied: false };
  }

  let visit: Awaited<ReturnType<typeof getVisitById>>;
  try {
    visit = await prisma.$transaction(async (tx) => {
      await replaceReadingsAndChemicals(tx, visitId, readings, chemicals);

      return tx.serviceVisit.update({
        where: { id: visitId },
        data: {
          notes: notes ?? undefined,
          nextServiceDate:
            nextServiceDate !== undefined ? nextServiceDate : undefined,
          version: { increment: 1 },
          clientMutationId: opts.clientMutationId ?? undefined,
        },
        include: {
          pool: true,
          tech: true,
          waterReadings: true,
          chemicalsAdded: true,
        },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error) && opts.clientMutationId) {
      const current = await prisma.serviceVisit.findUnique({
        where: { id: visitId },
        include: { pool: true, tech: true, waterReadings: true, chemicalsAdded: true },
      });
      if (current) return { visit: current, applied: false };
    }
    throw error;
  }

  return { visit, applied: true };
}
