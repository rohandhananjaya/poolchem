import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { DashboardStats } from "@/lib/db/dashboard"

function StatTile({
  label,
  value,
  hint,
  href,
}: {
  label: string
  value: string
  hint?: string
  href?: string
}) {
  const content = (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className="font-mono text-2xl font-bold tabular-nums text-card-foreground">
            {value}
          </span>
          {hint ? (
            <span className="text-base font-normal text-muted-foreground">
              {hint}
            </span>
          ) : null}
        </p>
      </div>
      {href ? (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      ) : null}
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}

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
