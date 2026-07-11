/**
 * Read model for the company-wide Reports page: a paginated, filterable list of
 * completed visits (each links to its full per-visit report).
 *
 * Everything is scoped to the tenant via `pool: { companyId }`, and all water
 * health is derived through the pure chemistry engine — this module holds no
 * domain logic of its own.
 */
import "server-only";

import { getWaterHealthScore } from "@/lib/pool-chemistry";
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

/** Filters for the reports list. */
export interface ReportFilters {
  poolId?: string;
  /** ISO date string (YYYY-MM-DD) — inclusive start. */
  fromDate?: string;
  /** ISO date string (YYYY-MM-DD) — inclusive end. */
  toDate?: string;
}

/** Everything the Reports page renders. Fully serializable. */
export interface CompanyReportData {
  recentVisits: ReportListItem[];
  /** Total number of completed visits matching the current filters. */
  total: number;
}

/** How many reports to show per page. */
export const REPORTS_PAGE_SIZE = 20;

/**
 * Returns a paginated, filterable list of completed visits for `companyId`.
 */
export async function getCompanyReportData(
  companyId: string,
  page: number = 1,
  filters?: ReportFilters,
): Promise<CompanyReportData> {
  const limit = REPORTS_PAGE_SIZE;
  const skip = (page - 1) * limit;

  const where: {
    pool: { companyId: string };
    status: "COMPLETED";
    poolId?: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = {
    pool: { companyId },
    status: "COMPLETED",
  };

  if (filters?.poolId) {
    where.poolId = filters.poolId;
  }

  if (filters?.fromDate || filters?.toDate) {
    where.createdAt = {};
    if (filters?.fromDate) {
      where.createdAt.gte = new Date(filters.fromDate);
    }
    if (filters?.toDate) {
      where.createdAt.lte = new Date(filters.toDate + "T23:59:59.999Z");
    }
  }

  const [visits, total] = await Promise.all([
    prisma.serviceVisit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        pool: { select: { name: true, address: true } },
        tech: { select: { name: true } },
        waterReadings: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.serviceVisit.count({ where }),
  ]);

  const recentVisits: ReportListItem[] = visits.map((visit) => {
    const reading = visit.waterReadings[0] ?? null;
    return {
      id: visit.id,
      poolName: visit.pool.name,
      address: visit.pool.address,
      techName: visit.tech?.name ?? "Unassigned",
      date: visit.createdAt.toISOString(),
      score: reading ? getWaterHealthScore(reading).score : null,
    };
  });

  return { recentVisits, total };
}
