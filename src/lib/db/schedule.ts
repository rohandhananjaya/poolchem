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

import { PAGE_SIZE } from "@/lib/config";
import { getWaterHealthScore, type WaterHealthStatus } from "@/lib/pool-chemistry";
import { prisma } from "@/lib/prisma";
import { ServiceVisitStatus } from "@/generated/prisma/client";

/** A single visit as shown on the Schedule page. Fully serializable. */
export interface ScheduledVisit {
  id: string;
  poolName: string;
  address: string | null;
  /** Homeowner phone number for dialing, or `null` when none on file. */
  homeownerPhone: string | null;
  status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
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
  /** "scheduled" = DRAFT + IN_PROGRESS (default), "all" = everything. */
  status?: "scheduled" | "all" | "cancelled" | "completed" | "in_progress";
  /** Pool id to narrow results. */
  poolId?: string;
  /** ISO date string (YYYY-MM-DD) — inclusive start. */
  fromDate?: string;
  /** ISO date string (YYYY-MM-DD) — inclusive end. */
  toDate?: string;
  /**
   * Restrict to visits a given tech may work: those assigned to them plus
   * unassigned ("anyone can take") visits. Visits assigned to other techs are
   * excluded. Leave undefined for owners/admins to see the whole company.
   */
  techId?: string;
}

/** How many visits per page on the schedule. */
export const SCHEDULE_PAGE_SIZE = PAGE_SIZE;

/**
 * Returns a paginated list of the company's visits ordered for the schedule:
 * by planned time (`scheduledAt`) first, then creation time. Visits without a
 * reading have `health: null`.
 */
export async function getScheduleData(
  companyId: string,
  page: number = 1,
  filters?: ScheduleFilters,
): Promise<{ visits: ScheduledVisit[]; total: number }> {
  const where: {
    pool: { companyId: string };
    status?: ServiceVisitStatus | { in: ServiceVisitStatus[] };
    poolId?: string;
    scheduledAt?: { gte?: Date; lte?: Date };
    OR?: Array<{ techId: string | null }>;
  } = {
    pool: { companyId },
  };

  if (filters?.techId) {
    // Techs see only their own visits plus unassigned ones — never a
    // visit assigned to another tech.
    where.OR = [{ techId: filters.techId }, { techId: null }];
  }

  if (filters?.status === "cancelled") {
    where.status = ServiceVisitStatus.CANCELLED;
  } else if (filters?.status === "completed") {
    where.status = ServiceVisitStatus.COMPLETED;
  } else if (filters?.status === "in_progress") {
    where.status = ServiceVisitStatus.IN_PROGRESS;
  } else if (filters?.status !== "all") {
    where.status = { in: [ServiceVisitStatus.DRAFT, ServiceVisitStatus.IN_PROGRESS] };
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

  const limit = SCHEDULE_PAGE_SIZE;
  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    prisma.serviceVisit.findMany({
      where,
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
      skip,
      take: limit,
      include: {
        pool: { select: { name: true, address: true, homeownerPhone: true } },
        tech: { select: { id: true, name: true } },
        waterReadings: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.serviceVisit.count({ where }),
  ]);

  const visits = rows.map((visit) => {
    const reading = visit.waterReadings[0] ?? null;
    const health = reading ? getWaterHealthScore(reading) : null;
    return {
      id: visit.id,
      poolName: visit.pool.name,
      address: visit.pool.address,
      homeownerPhone: visit.pool.homeownerPhone ?? null,
      status: visit.status,
      scheduledAt: visit.scheduledAt ? visit.scheduledAt.toISOString() : null,
      effectiveDate: (visit.scheduledAt ?? visit.createdAt).toISOString(),
      health: health ? { score: health.score, status: health.status } : null,
      assignedTech: visit.tech ? { id: visit.tech.id, name: visit.tech.name } : null,
    };
  });

  return { visits, total };
}
