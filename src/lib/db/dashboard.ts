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
import type { ServiceVisitStatus } from "@/generated/prisma/enums";

/** A single visit as rendered by {@link VisitCard} — primitives only. */
export interface DashboardVisit {
  id: string;
  /** The pool (client) name. */
  poolName: string;
  /** Street address, or `null` when the pool has none on file. */
  address: string | null;
  status: ServiceVisitStatus;
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
  /** Mean water-health score across scored visits, or `null` when none. */
  avgHealth: number | null;
  /** Active pools for the company. */
  activePools: number;
}

export interface DashboardData {
  visits: DashboardVisit[];
  stats: DashboardStats;
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
 * Loads everything the technician home dashboard needs for `companyId`:
 * today's visits (with the pool and the most recent water reading, from which a
 * health score is derived) and the headline stats.
 */
export async function getDashboardData(
  companyId: string,
): Promise<DashboardData> {
  const { gte, lt } = todayRange();

  const [visits, activePools] = await Promise.all([
    prisma.serviceVisit.findMany({
      where: { pool: { companyId }, createdAt: { gte, lt } },
      orderBy: { createdAt: "asc" },
      include: {
        pool: true,
        // Newest reading first — a completed visit's latest test drives its score.
        waterReadings: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.pool.count({ where: { companyId, isActive: true } }),
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
      // We have no scheduled-time field, so a visit only gets a time once it's
      // been serviced; everything else reads as "Unscheduled".
      timeLabel:
        visit.status === "COMPLETED" ? format(visit.updatedAt, "p") : null,
      health,
    };
  });

  const completed = dashboardVisits.filter(
    (visit) => visit.status === "COMPLETED",
  ).length;

  const scores = dashboardVisits
    .map((visit) => visit.health?.score)
    .filter((score): score is number => score !== undefined);
  const avgHealth = scores.length
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    : null;

  return {
    visits: dashboardVisits,
    stats: {
      completed,
      total: dashboardVisits.length,
      avgHealth,
      activePools,
    },
  };
}
