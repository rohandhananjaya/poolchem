/**
 * Public homeowner-dashboard assembly.
 *
 * {@link getHomeownerDashboard} gathers everything the no-login
 * `/pool/[publicToken]` page shows — the pool, the servicing company, the
 * latest water-health score, when the pool was last serviced and when it is
 * next due, a short activity timeline, and a score trend — and returns it as one
 * plain, serializable object. The page is a pure view over this object.
 *
 * All chemistry is derived here via the pure engine in
 * {@link "@/lib/pool-chemistry"}, and the query is scoped only by the
 * unguessable `publicToken` (never a `companyId`) — the token itself is the
 * access grant. **No sensitive data** (tech contact details, chemical doses,
 * internal notes, tenant IDs) is included.
 */
import "server-only";

import { addDays } from "date-fns";
import { headers } from "next/headers";

import { getPoolByPublicToken } from "@/lib/db/pools";
import {
  getWaterHealthScore,
  type WaterHealthResult,
  type WaterHealthStatus,
} from "@/lib/pool-chemistry";

import type { ReportScorePoint } from "./generate-report";

/** Days between service visits, used to project the next service date. */
const SERVICE_INTERVAL_DAYS = 7;

/** How many recent visits appear in the activity timeline. */
const TIMELINE_VISIT_COUNT = 5;

/** How many recent visits feed the water-health trend sparkline. */
const TREND_VISIT_COUNT = 12;

/** One entry in the recent-activity timeline. */
export interface HomeownerActivity {
  /** Visit id (stable list key). */
  id: string;
  /** Visit date, ISO string. */
  date: string;
  /** Water-health score at that visit, 0–100. */
  score: number;
  /** Categorical band for {@link score}. */
  status: WaterHealthStatus;
  /** First name of the servicing technician (friendly, not full contact). */
  techName: string;
}

/** Everything the public homeowner dashboard renders. Fully serializable. */
export interface HomeownerDashboard {
  pool: {
    name: string;
    image: string | null;
  };
  company: {
    name: string;
    logo: string | null;
    email: string;
    phone: string | null;
  };
  /** Latest water-health assessment, or `null` when no visit has a reading. */
  waterHealth: WaterHealthResult | null;
  /** Date of the most recent completed service, ISO string, or `null`. */
  lastServiced: string | null;
  /** Projected next service date, ISO string, or `null` when never serviced. */
  nextService: string | null;
  /** Most recent visits, newest first (max {@link TIMELINE_VISIT_COUNT}). */
  timeline: HomeownerActivity[];
  /** Water-health score over recent visits, oldest first (for the sparkline). */
  scoreHistory: ReportScorePoint[];
  /** Absolute URL of this dashboard, for the share action. */
  shareUrl: string;
}

/** Returns just the given name so the timeline stays friendly, not formal. */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Resolves the request's absolute origin (protocol + host). */
async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Assembles the public homeowner dashboard for a pool's `publicToken`.
 *
 * @param publicToken - The pool's public dashboard token (from the report link).
 * @returns The structured dashboard, or `null` for an unknown token (→ 404).
 */
export async function getHomeownerDashboard(
  publicToken: string,
): Promise<HomeownerDashboard | null> {
  const pool = await getPoolByPublicToken(publicToken, TREND_VISIT_COUNT);
  if (!pool) return null;

  // serviceVisits come back newest-first (see the db helper).
  const visits = pool.serviceVisits;
  const latest = visits[0] ?? null;
  const latestReading = latest?.waterReadings[0] ?? null;

  const waterHealth = latestReading
    ? getWaterHealthScore(latestReading)
    : null;

  const lastServiced = latest ? latest.createdAt : null;

  const timeline: HomeownerActivity[] = visits
    .slice(0, TIMELINE_VISIT_COUNT)
    .map((visit) => {
      const reading = visit.waterReadings[0];
      // Only show visits we can actually score.
      if (!reading) return null;
      const health = getWaterHealthScore(reading);
      return {
        id: visit.id,
        date: visit.createdAt.toISOString(),
        score: health.score,
        status: health.status,
        techName: visit.tech ? firstName(visit.tech.name) : "Unassigned",
      };
    })
    .filter((activity): activity is HomeownerActivity => activity !== null);

  // Newest-first from the DB; the sparkline reads left→right oldest-first.
  const scoreHistory: ReportScorePoint[] = visits
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

  const origin = await getOrigin();

  return {
    pool: {
      name: pool.name,
      image: pool.image,
    },
    company: {
      name: pool.company.name,
      logo: pool.company.logo,
      email: pool.company.email,
      phone: pool.company.phone,
    },
    waterHealth,
    lastServiced: lastServiced ? lastServiced.toISOString() : null,
    nextService: lastServiced
      ? addDays(lastServiced, SERVICE_INTERVAL_DAYS).toISOString()
      : null,
    timeline,
    scoreHistory,
    shareUrl: `${origin}/pool/${publicToken}`,
  };
}
