import { cn } from "@/lib/utils"
import type { LSIResult, WaterHealthStatus } from "@/lib/pool-chemistry"

export interface WaterHealthGaugeProps {
  score: number
  status: WaterHealthStatus
  lsi?: LSIResult | null
}

const size = 180
const strokeWidth = 10
const radius = 70
const circumference = 2 * Math.PI * radius
const center = size / 2

function scoreColor(score: number): string {
  if (score >= 90) return "stroke-emerald-500"
  if (score >= 75) return "stroke-lime-500"
  if (score >= 50) return "stroke-amber-500"
  return "stroke-red-500"
}

function statusColor(status: WaterHealthStatus): string {
  switch (status) {
    case "EXCELLENT":
      return "text-emerald-600 dark:text-emerald-400"
    case "GOOD":
      return "text-lime-600 dark:text-lime-400"
    case "FAIR":
      return "text-amber-600 dark:text-amber-400"
    case "POOR":
      return "text-red-600 dark:text-red-400"
  }
}

export function WaterHealthGauge({
  score,
  status,
  lsi,
}: WaterHealthGaugeProps) {
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="stroke-muted"
            strokeWidth={strokeWidth}
          />

          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            className={cn(
              "transition-all duration-500 ease-out",
              scoreColor(score),
            )}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* The headline score — monospace so it stays optically centered. */}
          <span className="font-mono text-3xl font-bold tabular-nums text-foreground">
            {score}
          </span>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            HEALTH
          </span>
        </div>
      </div>

      <span
        className={cn(
          "rounded-full px-3 py-1 text-sm font-semibold",
          statusColor(status),
          "bg-current/10",
        )}
      >
        {status === "EXCELLENT"
          ? "Excellent"
          : status === "GOOD"
            ? "Good"
            : status === "FAIR"
              ? "Fair"
              : "Poor"}
      </span>

      {lsi && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {/* LSI is a critical reading — monospace + semibold so it stands out. */}
          <span>
            LSI:{" "}
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {lsi.lsi.toFixed(2)}
            </span>
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              lsi.status === "BALANCED" &&
                "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
              lsi.status === "CORROSIVE" &&
                "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
              lsi.status === "SCALING" &&
                "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
            )}
          >
            {lsi.status === "BALANCED"
              ? "Balanced"
              : lsi.status === "CORROSIVE"
                ? "Corrosive"
                : "Scaling"}
          </span>
        </div>
      )}
    </div>
  )
}
