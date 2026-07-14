/**
 * Service-report assembly.
 *
 * {@link generateServiceReport} gathers everything a homeowner-facing service
 * report needs — the visit, its readings and chemicals, the pool, the servicing
 * company, a short score-history trend, and a QR link to the homeowner
 * dashboard — and returns it as one plain, serializable object. The report page
 * is a pure view over this object.
 *
 * All chemistry (score, LSI, per-parameter status) is derived here via the pure
 * engine in {@link "@/lib/pool-chemistry"} so the view holds no domain logic.
 */
import "server-only";

import { addDays } from "date-fns";
import { headers } from "next/headers";

import { getCompanyById } from "@/lib/db/company";
import { getVisitById, getVisitHistory } from "@/lib/db/visits";
import {
  calculateLSI,
  getIdealRange,
  getWaterHealthScore,
  type LSIResult,
  type WaterHealthResult,
} from "@/lib/pool-chemistry";

/** Days between service visits, used to project the next service date. */
const SERVICE_INTERVAL_DAYS = 7;

/** How many recent visits feed the water-health trend sparkline. */
const TREND_VISIT_COUNT = 6;

/** Verdict for a single reading relative to its ideal range. */
export type ParameterStatus = "ideal" | "low" | "high" | "info";

/** One row of the "What We Tested" table. */
export interface ReportParameter {
  /** Canonical parameter key (e.g. `"ph"`, `"freeChlorine"`). */
  key: string;
  /** Human-friendly label (e.g. `"pH"`, `"Free Chlorine"`). */
  label: string;
  /** The recorded value. */
  value: number;
  /** Unit for {@link value} (may be empty, e.g. for pH). */
  unit: string;
  /** Ideal range, or `null` for informational rows with no target (temperature). */
  ideal: { min: number; max: number } | null;
  /** Where {@link value} falls relative to {@link ideal}. */
  status: ParameterStatus;
}

/** A single point on the water-health trend. */
export interface ReportScorePoint {
  /** Visit date, ISO string. */
  date: string;
  /** Water-health score at that visit, 0–100. */
  score: number;
}

/** Everything the service-report page renders. Fully serializable. */
export interface ServiceReport {
  visit: {
    id: string;
    /** Visit date, ISO string. */
    date: string;
    status: string;
    notes: string | null;
  };
  company: {
    name: string;
    logo: string | null;
    email: string;
    phone: string | null;
    address: string | null;
  };
  pool: {
    name: string;
    address: string | null;
    /** Capacity in US gallons. */
    volume: number;
  };
  tech: { name: string };
  /** Overall water-health assessment, or `null` when the visit has no reading. */
  waterHealth: WaterHealthResult | null;
  /** Water-balance index, or `null` when the visit has no reading. */
  lsi: LSIResult | null;
  /** Per-parameter rows for the results table. */
  parameters: ReportParameter[];
  /** Chemicals the tech recorded adding during the visit. */
  chemicalsAdded: Array<{ name: string; amount: number; unit: string }>;
  /** Water-health score over recent visits, oldest first (for the sparkline). */
  scoreHistory: ReportScorePoint[];
  /** Projected next service date, ISO string. */
  nextServiceDate: string;
  /** Absolute URL the homeowner QR code points at. */
  homeownerUrl: string;
  /** Absolute URL for the public shareable report (/report/[publicToken]). */
  reportUrl: string;
}

/** The ordered parameters shown in the results table with their labels/units. */
const PARAMETER_ROWS: ReadonlyArray<{
  key: string;
  label: string;
  unit: string;
}> = [
  { key: "ph", label: "pH", unit: "" },
  { key: "freeChlorine", label: "Free Chlorine", unit: "ppm" },
  { key: "totalAlkalinity", label: "Total Alkalinity", unit: "ppm" },
  { key: "calciumHardness", label: "Calcium Hardness", unit: "ppm" },
  { key: "cyanuricAcid", label: "Cyanuric Acid", unit: "ppm" },
];

/** A recorded reading, keyed by the canonical parameter names. */
type Reading = {
  ph: number;
  freeChlorine: number;
  totalAlkalinity: number;
  calciumHardness: number;
  cyanuricAcid: number;
  temperature: number;
};

/** Builds the results-table rows (the five scored params plus temperature). */
function buildParameters(reading: Reading): ReportParameter[] {
  const rows: ReportParameter[] = PARAMETER_ROWS.map(({ key, label, unit }) => {
    const value = reading[key as keyof Reading];
    const ideal = getIdealRange(key);
    let status: ParameterStatus = "ideal";
    if (value < ideal.min) status = "low";
    else if (value > ideal.max) status = "high";
    return {
      key,
      label,
      value,
      unit,
      ideal: { min: ideal.min, max: ideal.max },
      status,
    };
  });

  // Temperature is recorded for LSI but has no ideal target — show it as info.
  rows.push({
    key: "temperature",
    label: "Temperature",
    value: reading.temperature,
    unit: "°F",
    ideal: null,
    status: "info",
  });

  return rows;
}

/** Resolves the request's absolute origin (protocol + host). */
async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Assembles the full service report for a completed (or draft) visit.
 *
 * Scoped to the tenant: returns `null` when the visit does not belong to
 * `companyId`, mirroring the read helpers in `db/`.
 *
 * @param visitId - The visit to report on.
 * @param companyId - The acting user's company (tenant scope).
 * @returns The structured report, or `null` on a cross-tenant / missing visit.
 */
export async function generateServiceReport(
  visitId: string,
  companyId: string,
): Promise<ServiceReport | null> {
  const [visit, company] = await Promise.all([
    getVisitById(visitId, companyId),
    getCompanyById(companyId),
  ]);

  if (!visit) return null;

  const reading = visit.waterReadings[0] ?? null;

  const waterHealth = reading ? getWaterHealthScore(reading) : null;
  const lsi = reading
    ? calculateLSI(
        reading.ph,
        reading.temperature,
        reading.calciumHardness,
        reading.totalAlkalinity,
      )
    : null;
  const parameters = reading ? buildParameters(reading) : [];

  const history = await getVisitHistory(visit.poolId, TREND_VISIT_COUNT);
  // getVisitHistory is newest-first; the sparkline reads left→right oldest-first.
  const scoreHistory: ReportScorePoint[] = history
    .map((v) => {
      const r = v.waterReadings[0];
      if (!r) return null;
      return {
        date: v.createdAt.toISOString(),
        score: getWaterHealthScore(r).score,
      };
    })
    .filter((p): p is ReportScorePoint => p !== null)
    .reverse();

  const origin = await getOrigin();

  return {
    visit: {
      id: visit.id,
      date: visit.createdAt.toISOString(),
      status: visit.status,
      notes: visit.notes,
    },
    company: {
      name: company?.name ?? "PoolChem",
      logo: company?.logo ?? null,
      email: company?.email ?? "",
      phone: company?.phone ?? null,
      address: company?.address ?? null,
    },
    pool: {
      name: visit.pool.name,
      address: visit.pool.address,
      volume: visit.pool.volume,
    },
    tech: { name: visit.tech?.name ?? "Unassigned" },
    waterHealth,
    lsi,
    parameters,
    chemicalsAdded: visit.chemicalsAdded.map((c) => ({
      name: c.name,
      amount: c.amount,
      unit: c.unit,
    })),
    scoreHistory,
    nextServiceDate: addDays(visit.createdAt, SERVICE_INTERVAL_DAYS).toISOString(),
    homeownerUrl: `${origin}/pool/${visit.pool.publicToken}`,
    reportUrl: visit.publicToken
      ? `${origin}/report/${visit.publicToken}`
      : `${origin}/visits/${visit.id}/report`,
  };
}
