/**
 * Read model for the Schedule page: the company's visits ordered by when they
 * are planned for, with just enough of each visit to render a schedule card.
 *
 * A visit's `scheduledAt` may be null (ad-hoc visits created by scanning a pool
 * in the field). Such visits fall back to their `createdAt` for placement on the
 * schedule, exposed here as `effectiveDate`.
 *
 * Scoped to the tenant via `pool: { companyId }`; water health is derived
 * through the pure chemistry engine.
 */
import "server-only";

import { getWaterHealthScore, type WaterHealthStatus } from "@/lib/pool-chemistry";
import { prisma } from "@/lib/prisma";
import { ServiceVisitStatus } from "@/generated/prisma/client";

/** A single visit as shown on the Schedule page. Fully serializable. */
export interface ScheduledVisit {
  id: string;
  poolName: string;
  address: string | null;
  status: "DRAFT" | "COMPLETED" | "CANCELLED";
  /** Planned time, ISO string, or `null` when the visit was created ad hoc. */
  scheduledAt: string | null;
  /** `scheduledAt ?? createdAt`, ISO string — used to place the visit on a day. */
  effectiveDate: string;
  /** Water-health snapshot from the latest reading, or `null` when none. */
  health: { score: number; status: WaterHealthStatus } | null;
  /** The assigned tech, or `null` when unassigned (anyone can take). */
  assignedTech: { id: string; name: string } | null;
}

/** Filters for the schedule list. */
export interface ScheduleFilters {
  /** "scheduled" = exclude CANCELLED (default), "all" = everything, "cancelled" = only cancelled. */
  status?: "scheduled" | "all" | "cancelled";
  /** Pool id to narrow results. */
  poolId?: string;
  /** ISO date string (YYYY-MM-DD) — inclusive start. */
  fromDate?: string;
  /** ISO date string (YYYY-MM-DD) — inclusive end. */
  toDate?: string;
}

/** How many visits the schedule loads. */
const SCHEDULE_LIMIT = 200;

/**
 * Returns the company's visits ordered for the schedule: by planned time
 * (`scheduledAt`) first, then creation time. Visits without a reading have
 * `health: null`.
 */
export async function getScheduleData(
  companyId: string,
  filters?: ScheduleFilters,
): Promise<ScheduledVisit[]> {
  const where: {
    pool: { companyId: string };
    status?: Record<string, unknown> | "DRAFT" | "COMPLETED" | "CANCELLED";
    poolId?: string;
    scheduledAt?: { gte?: Date; lte?: Date };
  } = {
    pool: { companyId },
  };

  if (filters?.status === "cancelled") {
    where.status = ServiceVisitStatus.CANCELLED;
  } else if (filters?.status !== "all") {
    where.status = { not: ServiceVisitStatus.CANCELLED };
  }

  if (filters?.poolId) {
    where.poolId = filters.poolId;
  }

  if (filters?.fromDate || filters?.toDate) {
    where.scheduledAt = {};
    if (filters?.fromDate) {
      where.scheduledAt.gte = new Date(filters.fromDate);
    }
    if (filters?.toDate) {
      where.scheduledAt.lte = new Date(filters.toDate + "T23:59:59.999Z");
    }
  }

  const visits = await prisma.serviceVisit.findMany({
    where,
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    take: SCHEDULE_LIMIT,
    include: {
      pool: { select: { name: true, address: true } },
      tech: { select: { id: true, name: true } },
      waterReadings: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return visits.map((visit) => {
    const reading = visit.waterReadings[0] ?? null;
    const health = reading ? getWaterHealthScore(reading) : null;
    return {
      id: visit.id,
      poolName: visit.pool.name,
      address: visit.pool.address,
      status: visit.status,
      scheduledAt: visit.scheduledAt ? visit.scheduledAt.toISOString() : null,
      effectiveDate: (visit.scheduledAt ?? visit.createdAt).toISOString(),
      health: health ? { score: health.score, status: health.status } : null,
      assignedTech: visit.tech ? { id: visit.tech.id, name: visit.tech.name } : null,
    };
  });
}
