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

// Water fill sits inside the ring, clear of the stroke.
const waterDiameter = (radius - strokeWidth) * 2
const waveLength = 40
// Must be >= the translateX amplitude in the wave-flow keyframes (globals.css)
// so the wave never runs out of path at either end of its animated swing.
const waveMargin = 70

function scoreColor(score: number): string {
  if (score >= 90) return "stroke-emerald-500"
  if (score >= 75) return "stroke-lime-500"
  if (score >= 50) return "stroke-amber-500"
  return "stroke-red-500"
}

function waterColor(score: number): { back: string; front: string } {
  if (score >= 90) return { back: "fill-emerald-500/20", front: "fill-emerald-400/35" }
  if (score >= 75) return { back: "fill-lime-500/20", front: "fill-lime-400/35" }
  if (score >= 50) return { back: "fill-amber-500/20", front: "fill-amber-400/35" }
  return { back: "fill-red-500/20", front: "fill-red-400/35" }
}

// A wavy top edge closed down to the bottom of the box, drawn wider than the
// box so it can be translated horizontally (animate-wave-flow) without its
// edges ever coming into view.
function wavePath(y: number, amplitude: number): string {
  const startX = -waveMargin
  const endX = waterDiameter + waveMargin
  let d = `M ${startX} ${y}`
  let crestUp = true
  for (let x = startX; x < endX; x += waveLength) {
    const nextX = x + waveLength
    const controlY = crestUp ? y - amplitude : y + amplitude
    d += ` Q ${x + waveLength / 2} ${controlY} ${nextX} ${y}`
    crestUp = !crestUp
  }
  d += ` L ${endX} ${waterDiameter} L ${startX} ${waterDiameter} Z`
  return d
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
  const waterLevel = waterDiameter * (1 - score / 100)
  const water = waterColor(score)

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

        <div
          className="absolute overflow-hidden rounded-full"
          style={{
            width: waterDiameter,
            height: waterDiameter,
            top: center - waterDiameter / 2,
            left: center - waterDiameter / 2,
          }}
        >
          <svg
            width={waterDiameter}
            height={waterDiameter}
            viewBox={`0 0 ${waterDiameter} ${waterDiameter}`}
            className="absolute inset-0"
          >
            <path
              d={wavePath(waterLevel, 4)}
              className={cn(
                "motion-safe:animate-wave-flow transition-[d] duration-500 ease-out",
                water.back,
              )}
              style={{ animationDuration: "7s" }}
            />
            <path
              d={wavePath(waterLevel + 3, 5)}
              className={cn(
                "motion-safe:animate-wave-flow transition-[d] duration-500 ease-out",
                water.front,
              )}
              style={{ animationDuration: "5s", animationDelay: "-1s" }}
            />
          </svg>
        </div>

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
