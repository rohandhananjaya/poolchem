/**
 * Data access for the technician home dashboard.
 *
 * Composes the day's service route (today's visits with their pool and latest
 * water reading) plus a few headline stats, and shapes everything into a plain,
 * presentation-ready view model so the dashboard components stay dumb.
 *
 * Everything is scoped to a tenant (`companyId`) through the visit's pool, the
 * same relation-safety rule the rest of the visit data layer follows.
 */
import "server-only";

import { format } from "date-fns";

import {
  getWaterHealthScore,
  type WaterHealthStatus,
} from "@/lib/pool-chemistry";
import { prisma } from "@/lib/prisma";
import { ServiceVisitStatus } from "@/generated/prisma/client";
import { todayRange } from "@/lib/date-utils";

/** A single visit as rendered by {@link VisitCard} — primitives only. */
export interface DashboardVisit {
  id: string;
  /** The pool (client) name. */
  poolName: string;
  /** Street address, or `null` when the pool has none on file. */
  address: string | null;
  status: ServiceVisitStatus;
  /** The assigned tech's ID, or `null` when unassigned. */
  techId: string | null;
  /** Formatted service time, or `null` to render as "Unscheduled". */
  timeLabel: string | null;
  /** Water-health summary, or `null` when the visit has no reading yet. */
  health: { score: number; status: WaterHealthStatus } | null;
}

/** Headline counters shown in the stats row. */
export interface DashboardStats {
  /** Visits marked COMPLETED today. */
  completed: number;
  /** Total visits on today's route. */
  total: number;
  /** Visits scheduled for future dates (after today). */
  upcomingVisits: number;
  /** Active pools for the company. */
  activePools: number;
}

export interface DashboardData {
  visits: DashboardVisit[];
  stats: DashboardStats;
}

/**
 * Returns the company's visits for today — those scheduled for today or created
 * ad-hoc today (the day's route) — with their pool and the most recent water
 * reading, plus headline stats. Ordered by scheduled time (null last), then
 * creation time.
 *
 * Everything is scoped to a tenant (`companyId`) through the visit's pool, the
 * same relation-safety rule the rest of the visit data layer follows.
 */
export async function getDashboardData(
  companyId: string,
): Promise<DashboardData> {
  const { gte, lt } = todayRange();

  const [visits, activePools, upcomingVisits] = await Promise.all([
    prisma.serviceVisit.findMany({
      where: {
        pool: { companyId },
        status: { not: ServiceVisitStatus.CANCELLED },
        OR: [
          { scheduledAt: { gte, lt } },
          { scheduledAt: null, createdAt: { gte, lt } },
        ],
      },
      orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      include: {
        pool: true,
        // Newest reading first — a completed visit's latest test drives its score.
        waterReadings: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.pool.count({ where: { companyId, isActive: true } }),
    prisma.serviceVisit.count({
      where: {
        pool: { companyId },
        status: { not: ServiceVisitStatus.CANCELLED },
        scheduledAt: { gt: lt },
      },
    }),
  ]);

  const dashboardVisits: DashboardVisit[] = visits.map((visit) => {
    const reading = visit.waterReadings[0];
    const health = reading
      ? (({ score, status }) => ({ score, status }))(
          getWaterHealthScore(reading),
        )
      : null;

    return {
      id: visit.id,
      poolName: visit.pool.name,
      address: visit.pool.address,
      status: visit.status,
      techId: visit.techId,
      // Show the scheduled date when one is set (the form has no time picker);
      // otherwise show the completion time for completed visits, or null
      // ("Unscheduled") for ad-hoc uncompleted visits.
      timeLabel:
        visit.scheduledAt
          ? format(visit.scheduledAt, "EEE, MMM d")
          : visit.status === "COMPLETED"
            ? format(visit.updatedAt, "p")
            : null,
      health,
    };
  });

  const completed = dashboardVisits.filter(
    (visit) => visit.status === "COMPLETED",
  ).length;

  return {
    visits: dashboardVisits,
    stats: {
      completed,
      total: dashboardVisits.length,
      upcomingVisits,
      activePools,
    },
  };
}
