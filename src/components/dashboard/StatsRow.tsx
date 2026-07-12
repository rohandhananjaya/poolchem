import { StatTile } from "@/components/ui/stat-tile"
import type { DashboardStats } from "@/lib/db/dashboard"

export interface StatsRowProps {
  stats: DashboardStats
  /** ISO date string (YYYY-MM-DD) for today. */
  today: string
  /** ISO date string (YYYY-MM-DD) for tomorrow. */
  tomorrow: string
}

/** The three headline counters shown above today's visits. */
export function StatsRow({ stats, today, tomorrow }: StatsRowProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatTile
        label="Today's Visits"
        value={`${stats.completed}/${stats.total}`}
        hint="completed"
        href={`/schedule?fromDate=${today}&toDate=${today}`}
      />
      <StatTile
        label="Upcoming Visits"
        value={String(stats.upcomingVisits)}
        href={`/schedule?fromDate=${tomorrow}`}
      />
      <StatTile
        label="Active Pools"
        value={String(stats.activePools)}
        href="/pools?status=active"
      />
    </div>
  )
}
