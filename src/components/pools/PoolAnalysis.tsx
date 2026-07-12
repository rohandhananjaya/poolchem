"use client"

import * as React from "react"
import Link from "next/link"
import { format } from "date-fns"
import {
  Calendar,
  FlaskConical,
  Home,
  MapPin,
  Phone,
  Thermometer,
  User,
} from "lucide-react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { cn } from "@/lib/utils"
import { healthBadgeClasses } from "@/components/ui/badge"
import { ActiveBadge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScoreSparkline } from "@/components/reports/ScoreSparkline"
import type { ReportScorePoint } from "@/lib/reports/generate-report"

/* ── colour palette for parameter trend lines ────────────────────── */
const PARAM_COLORS: Record<string, string> = {
  pH: "#0d9488",
  "Free Cl₂": "#6366f1",
  "Total Alk": "#f97316",
  "Ca Hardness": "#ec4899",
  "CYA": "#64748b",
}

const IDEAL_RANGES: Record<string, { min: number; max: number }> = {
  pH: { min: 7.2, max: 7.8 },
  "Free Cl₂": { min: 2, max: 4 },
  "Total Alk": { min: 80, max: 120 },
  "Ca Hardness": { min: 200, max: 400 },
  "CYA": { min: 30, max: 50 },
}

/* ── types ───────────────────────────────────────────────────────── */
interface ScoredVisit {
  id: string
  date: string
  scheduledAt: string | null
  tech: { id: string; name: string } | null
  waterHealth: { score: number; status: string; issues: string[] } | null
  readings: Array<{
    ph: number
    freeChlorine: number
    totalAlkalinity: number
    calciumHardness: number
    cyanuricAcid: number
    temperature: number
  }>
  chemicals: Array<{ name: string; amount: number; unit: string }>
  notes: string | null
}

interface PoolAnalysisProps {
  pool: {
    id: string
    name: string
    address: string | null
    volume: number
    isActive: boolean
    homeownerEmail: string | null
    homeownerPhone: string | null
  }
  scoredVisits: ScoredVisit[]
  scoreHistory: ReportScorePoint[]
  lastReadings: {
    ph: number
    freeChlorine: number
    totalAlkalinity: number
    calciumHardness: number
    cyanuricAcid: number
    temperature: number
  } | null
}

/* ── parameter display helpers ──────────────────────────────────── */
function paramStatus(value: number, ideal: { min: number; max: number }): string {
  if (value < ideal.min) return "low"
  if (value > ideal.max) return "high"
  return "good"
}

function paramColor(status: string): string {
  if (status === "good") return "text-emerald-600 dark:text-emerald-400"
  if (status === "low") return "text-amber-600 dark:text-amber-400"
  return "text-rose-600 dark:text-rose-400"
}

/* ── component ──────────────────────────────────────────────────── */
export function PoolAnalysis({ pool, scoredVisits, scoreHistory, lastReadings }: PoolAnalysisProps) {
  /* flatten the last 10 visits into chart data points */
  const chartData = scoredVisits
    .slice(0, 10)
    .reverse()
    .map((v) => ({
      date: v.date,
      pH: Number(v.readings[0]?.ph.toFixed(1)),
      "Free Cl₂": Number(v.readings[0]?.freeChlorine.toFixed(1)),
      "Total Alk": Math.round(v.readings[0]?.totalAlkalinity),
      "Ca Hardness": Math.round(v.readings[0]?.calciumHardness),
      CYA: Math.round(v.readings[0]?.cyanuricAcid),
    }))

  return (
    <>
      {/* ── Pool Info Card ─────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-card-foreground">
                {pool.name}
              </h2>
              {<ActiveBadge active={pool.isActive} />}
            </div>

            {pool.address ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">{pool.address}</span>
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <FlaskConical className="size-3.5" />
                {pool.volume.toLocaleString()} gal
              </span>
              {pool.homeownerEmail ? (
                <span className="inline-flex items-center gap-1">
                  <Home className="size-3.5" />
                  {pool.homeownerEmail}
                </span>
              ) : null}
              {pool.homeownerPhone ? (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3.5" />
                  {pool.homeownerPhone}
                </span>
              ) : null}
            </div>
          </div>

          <Button asChild variant="outline" size="sm">
            <Link href={`/pool/${pool.id}`}>Homeowner Dashboard</Link>
          </Button>
        </div>
      </div>

      {/* ── Last Readings Summary ──────────────────────────────── */}
      {lastReadings ? (
        <section>
          <h3 className="mb-3 text-sm font-medium text-foreground">Latest Readings</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {(
              [
                { label: "pH", value: lastReadings.ph, key: "pH" },
                { label: "Free Cl₂", value: lastReadings.freeChlorine, key: "Free Cl₂" },
                { label: "Total Alk", value: lastReadings.totalAlkalinity, key: "Total Alk" },
                { label: "Ca Hardness", value: lastReadings.calciumHardness, key: "Ca Hardness" },
                { label: "CYA", value: lastReadings.cyanuricAcid, key: "CYA" },
                { label: "Temp", value: lastReadings.temperature, key: "temp", suffix: "°F" },
              ] as const
            ).map((item) => {
              const { label, value, key } = item
              const suffix = "suffix" in item ? item.suffix : ""
              const ideal = IDEAL_RANGES[key]
              const status = ideal ? paramStatus(value, ideal) : "good"
              return (
                <div
                  key={key}
                  className="rounded-xl border border-border bg-card p-3 text-center"
                >
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p
                    className={cn(
                      "mt-1 font-mono text-lg font-bold tabular-nums",
                      paramColor(status),
                    )}
                  >
                    {value}
                    {suffix}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {/* ── Water-Health Score Trend ───────────────────────────── */}
      <section>
        <h3 className="mb-3 text-sm font-medium text-foreground">Water Health Trend</h3>
        <div className="rounded-xl border border-border bg-card p-4">
          <ScoreSparkline points={scoreHistory} />
        </div>
      </section>

      {/* ── Parameter Trend Chart ──────────────────────────────── */}
      {chartData.length > 1 && (
        <section>
          <h3 className="mb-3 text-sm font-medium text-foreground">Parameter Trends</h3>
          <div className="rounded-xl border border-border bg-card p-4">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.6} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val) => format(new Date(val), "MMM d")}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length || !label) return null
                    return (
                      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
                        <p className="mb-1 font-semibold text-foreground">
                          {format(new Date(String(label)), "MMM d, yyyy")}
                        </p>
                        {payload.map((entry) => (
                          <p
                            key={entry.name}
                            className="flex items-center gap-2 text-xs text-muted-foreground"
                          >
                            <span
                              className="inline-block size-2 rounded-full"
                              style={{ background: entry.color }}
                            />
                            {entry.name}: {entry.value}
                          </p>
                        ))}
                      </div>
                    )
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, color: "var(--color-muted-foreground)" }}
                />
                {Object.entries(PARAM_COLORS).map(([key, color]) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: color }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ── Visit History ──────────────────────────────────────── */}
      <section>
        <h3 className="mb-3 text-sm font-medium text-foreground">Visit History</h3>
        <div className="space-y-2">
          {scoredVisits.map((visit) => (
            <Link
              key={visit.id}
              href={`/visits/${visit.id}/report?from=/pools/${pool.id}`}
              className="flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-sm text-foreground">
                    {format(new Date(visit.date), "MMM d, yyyy")}
                  </span>
                  {visit.tech ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="size-3" />
                      {visit.tech.name}
                    </span>
                  ) : null}
                </div>

                {visit.waterHealth ? (
                  <span
                    className={cn(
                      "mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                      healthBadgeClasses(visit.waterHealth.score),
                    )}
                  >
                    {visit.waterHealth.score}
                  </span>
                ) : (
                  <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    No reading
                  </span>
                )}

                {visit.notes ? (
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {visit.notes}
                  </p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
