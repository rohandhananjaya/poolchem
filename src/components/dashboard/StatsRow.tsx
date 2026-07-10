import type { DashboardStats } from "@/lib/db/dashboard"

function StatTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums text-card-foreground">
          {value}
        </span>
        {hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </p>
    </div>
  )
}

export interface StatsRowProps {
  stats: DashboardStats
}

/** The three headline counters shown above today's visits. */
export function StatsRow({ stats }: StatsRowProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatTile
        label="Today's Visits"
        value={`${stats.completed}/${stats.total}`}
        hint="completed"
      />
      <StatTile
        label="Avg Water Health"
        value={stats.avgHealth === null ? "—" : String(stats.avgHealth)}
      />
      <StatTile label="Active Pools" value={String(stats.activePools)} />
    </div>
  )
}
