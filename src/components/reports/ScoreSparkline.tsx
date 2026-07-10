import type { ReportScorePoint } from "@/lib/reports/generate-report"

export interface ScoreSparklineProps {
  points: ReportScorePoint[]
  /** Width in px of the drawing area. */
  width?: number
  /** Height in px of the drawing area. */
  height?: number
}

/**
 * A compact water-health-score trend line over recent visits. Pure SVG so it
 * renders on the server and prints crisply. Scores are plotted on a fixed
 * 0–100 scale so heights are comparable across reports.
 */
export function ScoreSparkline({
  points,
  width = 260,
  height = 56,
}: ScoreSparklineProps) {
  if (points.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No previous visits to chart yet.
      </p>
    )
  }

  const pad = 4
  const innerW = width - pad * 2
  const innerH = height - pad * 2

  // With a single point, pin it to the centre; otherwise spread evenly.
  const x = (i: number) =>
    points.length === 1
      ? width / 2
      : pad + (i / (points.length - 1)) * innerW
  const y = (score: number) => pad + (1 - score / 100) * innerH

  const coords = points.map((p, i) => ({ cx: x(i), cy: y(p.score) }))
  const line = coords.map((c) => `${c.cx},${c.cy}`).join(" ")
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`
  const last = coords[coords.length - 1]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Water health score trend over the last ${points.length} visits`}
      className="overflow-visible"
    >
      <defs>
        <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {points.length > 1 && (
        <polygon points={area} fill="url(#sparkline-fill)" className="text-teal-500" />
      )}

      {points.length > 1 && (
        <polyline
          points={line}
          fill="none"
          className="stroke-teal-500"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {coords.map((c, i) => (
        <circle
          key={i}
          cx={c.cx}
          cy={c.cy}
          r={i === coords.length - 1 ? 3.5 : 2}
          className={i === coords.length - 1 ? "fill-teal-500" : "fill-teal-400"}
        />
      ))}

      <text
        x={last.cx}
        y={Math.max(last.cy - 7, 10)}
        textAnchor="end"
        className="fill-foreground text-[10px] font-semibold"
      >
        {points[points.length - 1].score}
      </text>
    </svg>
  )
}
