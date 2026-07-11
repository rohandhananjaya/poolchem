"use client"

import { useId } from "react"
import { format } from "date-fns"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { ReportScorePoint } from "@/lib/reports/generate-report"

// Brand teal (Tailwind teal-600/500) — constant across light and dark, so we
// use the fixed hex rather than reading a CSS var at runtime.
const TEAL = { line: "#0d9488", glow: "#14b8a6" } as const

const SCORE_COLORS = {
  excellent: "#0d9488",
  good: "#2563eb",
  fair: "#d97706",
  poor: "#e11d48",
} as const

function getScoreColor(score: number): string {
  if (score >= 90) return SCORE_COLORS.excellent
  if (score >= 75) return SCORE_COLORS.good
  if (score >= 50) return SCORE_COLORS.fair
  return SCORE_COLORS.poor
}

function getStatus(score: number): string {
  if (score >= 90) return "Excellent"
  if (score >= 75) return "Good"
  if (score >= 50) return "Fair"
  return "Poor"
}

export interface ScoreSparklineProps {
  points: ReportScorePoint[]
}

export function ScoreSparkline({ points }: ScoreSparklineProps) {
  const gradientId = useId()
  const teal = TEAL

  if (points.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No previous visits to chart yet.
      </p>
    )
  }

  const latest = points[points.length - 1]
  const previous = points.length > 1 ? points[points.length - 2] : null
  const delta = previous ? latest.score - previous.score : 0

  return (
    <div className="relative w-full">
      {/* Current-score badge: the headline value, decoupled from the plot so it
          stays readable no matter where the line sits. */}
      <div className="pointer-events-none absolute right-1 top-0 z-10 flex flex-col items-end">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold leading-none tracking-tight text-foreground tabular-nums">
            {latest.score}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {getStatus(latest.score)}
          </span>
        </div>
        {previous && (
          <span
            className={
              "mt-1 inline-flex items-center gap-0.5 text-xs font-medium tabular-nums " +
              (delta > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : delta < 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-muted-foreground")
            }
          >
            {delta > 0 ? (
              <ArrowUpRight className="size-3.5" />
            ) : delta < 0 ? (
              <ArrowDownRight className="size-3.5" />
            ) : (
              <Minus className="size-3.5" />
            )}
            {delta > 0 ? "+" : ""}
            {delta}{" "}
            <span className="text-muted-foreground">vs last visit</span>
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={216}>
        <AreaChart data={points} margin={{ top: 40, right: 12, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={teal.glow} stopOpacity={0.28} />
              <stop offset="100%" stopColor={teal.glow} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--color-border)"
            strokeOpacity={0.6}
          />
          <XAxis
            dataKey="date"
            tickFormatter={(val) => format(new Date(val), "MMM d")}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            minTickGap={24}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            ticks={[0, 25, 50, 75, 100]}
            width={40}
          />
          <Tooltip
            cursor={{
              stroke: teal.line,
              strokeWidth: 1.5,
              strokeOpacity: 0.5,
            }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const point = payload[0].payload as ReportScorePoint
              return (
                <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
                  <p className="flex items-center gap-1.5 font-semibold text-foreground">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ background: getScoreColor(point.score) }}
                    />
                    Score {point.score} &middot; {getStatus(point.score)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {format(new Date(point.date), "MMM d, yyyy")}
                  </p>
                </div>
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke={teal.line}
            fill={`url(#${gradientId})`}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            isAnimationActive
            animationDuration={800}
            dot={({ cx, cy, index, payload }) => {
              if (typeof cx !== "number" || typeof cy !== "number") return null
              const point = (payload ?? points[index]) as ReportScorePoint | undefined
              if (!point || typeof point.score !== "number") return null
              const isLast = index === points.length - 1
              const color = getScoreColor(point.score)
              return (
                <circle
                  key={index}
                  cx={cx}
                  cy={cy}
                  r={isLast ? 4.5 : 2.5}
                  fill={color}
                  stroke="var(--color-background)"
                  strokeWidth={2}
                  fillOpacity={isLast ? 1 : 0.55}
                />
              )
            }}
            activeDot={({ payload }) => {
              const color = getScoreColor((payload as ReportScorePoint).score)
              return (
                <circle
                  r={6}
                  fill={color}
                  stroke="var(--color-background)"
                  strokeWidth={2.5}
                />
              )
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
