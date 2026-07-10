/**
 * Read model for the company-wide Reports page: headline stats, a water-health
 * trend across recent visits, and a list of recent completed visits (each links
 * to its full per-visit report).
 *
 * Everything is scoped to the tenant via `pool: { companyId }`, and all water
 * health is derived through the pure chemistry engine — this module holds no
 * domain logic of its own.
 */
import "server-only";

import { getCompanyStats, type CompanyStats } from "@/lib/db/company";
import { getWaterHealthScore } from "@/lib/pool-chemistry";
import type { ReportScorePoint } from "@/lib/reports/generate-report";
import { prisma } from "@/lib/prisma";

/** One completed visit in the recent-reports list. */
export interface ReportListItem {
  /** Visit id — links to `/visits/{id}/report`. */
  id: string;
  poolName: string;
  address: string | null;
  techName: string;
  /** Visit date, ISO string. */
  date: string;
  /** Water-health score (0–100), or `null` when the visit has no reading. */
  score: number | null;
}

/** Everything the Reports page renders. Fully serializable. */
export interface CompanyReportData {
  stats: CompanyStats;
  /** Water-health score over recent visits, oldest-first (for the sparkline). */
  trend: ReportScorePoint[];
  recentVisits: ReportListItem[];
}

/** How many recent completed visits the list and trend draw from. */
const DEFAULT_LIMIT = 20;

/**
 * Assembles the company-wide report view for `companyId`: stats, a trend, and
 * the most recent completed visits (newest first).
 */
export async function getCompanyReportData(
  companyId: string,
  limit: number = DEFAULT_LIMIT,
): Promise<CompanyReportData> {
  const [stats, visits] = await Promise.all([
    getCompanyStats(companyId),
    prisma.serviceVisit.findMany({
      where: { pool: { companyId }, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        pool: { select: { name: true, address: true } },
        tech: { select: { name: true } },
        waterReadings: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);

  const recentVisits: ReportListItem[] = visits.map((visit) => {
    const reading = visit.waterReadings[0] ?? null;
    return {
      id: visit.id,
      poolName: visit.pool.name,
      address: visit.pool.address,
      techName: visit.tech.name,
      date: visit.createdAt.toISOString(),
      score: reading ? getWaterHealthScore(reading).score : null,
    };
  });

  // The sparkline reads left→right oldest-first; `visits` is newest-first.
  const trend: ReportScorePoint[] = visits
    .map((visit) => {
      const reading = visit.waterReadings[0];
      if (!reading) return null;
      return {
        date: visit.createdAt.toISOString(),
        score: getWaterHealthScore(reading).score,
      };
    })
    .filter((point): point is ReportScorePoint => point !== null)
    .reverse();

  return { stats, trend, recentVisits };
}
