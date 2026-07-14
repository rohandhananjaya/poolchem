import "server-only";

import { headers } from "next/headers";

import {
  getVisitByPublicToken,
  getPoolNextScheduledVisit,
} from "@/lib/db/visits";
import {
  calculateLSI,
  getIdealRange,
  getWaterHealthScore,
} from "@/lib/pool-chemistry";

import type {
  ParameterStatus,
  ReportParameter,
  ReportScorePoint,
  ServiceReport,
} from "./generate-report";

const TREND_VISIT_COUNT = 6;

async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

type Reading = {
  ph: number;
  freeChlorine: number;
  totalAlkalinity: number;
  calciumHardness: number;
  cyanuricAcid: number;
  temperature: number;
};

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

  rows.push({
    key: "temperature",
    label: "Temperature",
    value: reading.temperature,
    unit: "\u00b0F",
    ideal: null,
    status: "info",
  });

  return rows;
}

export async function getPublicReport(
  publicToken: string,
): Promise<ServiceReport | null> {
  const visit = await getVisitByPublicToken(publicToken);
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

  const origin = await getOrigin();

  const manualDate = visit.nextServiceDate
    ? new Date(visit.nextServiceDate)
    : null;
  const scheduledDate = await getPoolNextScheduledVisit(visit.poolId);

  let nextServiceDate: string | null = null;
  if (manualDate && scheduledDate) {
    nextServiceDate = new Date(
      Math.max(manualDate.getTime(), scheduledDate.getTime()),
    ).toISOString();
  } else if (manualDate) {
    nextServiceDate = manualDate.toISOString();
  } else if (scheduledDate) {
    nextServiceDate = scheduledDate.toISOString();
  }

  return {
    visit: {
      id: visit.id,
      date: visit.createdAt.toISOString(),
      status: visit.status,
      notes: visit.notes,
    },
    company: {
      name: visit.pool.company.name,
      logo: visit.pool.company.logo,
      email: visit.pool.company.email,
      phone: visit.pool.company.phone,
      address: visit.pool.company.address,
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
    scoreHistory: [],
    nextServiceDate,
    homeownerUrl: `${origin}/pool/${visit.pool.publicToken}`,
    reportUrl: `${origin}/report/${publicToken}`,
  };
}
