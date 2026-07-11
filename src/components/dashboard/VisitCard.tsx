import Link from "next/link"
import { CheckCircle2, Clock, MapPin } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { DashboardVisit } from "@/lib/db/dashboard"

/** Maps a 0–100 water-health score to a traffic-light badge tone. */
function healthClasses(score: number): string {
  if (score >= 75) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
  }
  if (score >= 50) {
    return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
  }
  return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
}

function HealthBadge({ health }: { health: DashboardVisit["health"] }) {
  if (!health) {
    return (
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        No reading
      </span>
    )
  }

  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
        healthClasses(health.score)
      )}
      title={`Water health: ${health.status.toLowerCase()}`}
    >
      {health.score}
    </span>
  )
}

export interface VisitCardProps {
  visit: DashboardVisit
}

/**
 * A single service visit on today's route: client name + address, its time
 * slot, a colored water-health badge, and either a "Start Visit" action or a
 * completed marker.
 */
export function VisitCard({ visit }: VisitCardProps) {
  const completed = visit.status === "COMPLETED"

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {/* Primary identifier — large & semibold for a quick glance on route. */}
          <h3 className="truncate text-lg font-semibold text-card-foreground">
            {visit.poolName}
          </h3>
          <HealthBadge health={visit.health} />
        </div>

        {visit.address ? (
          <p className="mt-1 flex items-center gap-1.5 text-base font-medium text-muted-foreground">
            <MapPin className="size-4 shrink-0" />
            <span className="truncate">{visit.address}</span>
          </p>
        ) : null}

        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5 shrink-0" />
          {visit.timeLabel ?? "Unscheduled"}
        </p>
      </div>

      <div className="shrink-0">
        {completed ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-4" />
            Completed
          </span>
        ) : (
          <Button asChild size="lg" className="h-11 px-4 text-lg">
            <Link href={`/visits/${visit.id}`}>Start Visit</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
