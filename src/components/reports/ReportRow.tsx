import Link from "next/link"
import { ChevronRight, MapPin } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ReportListItem } from "@/lib/db/reports"

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

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
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
        healthClasses(score),
      )}
    >
      {score}
    </span>
  )
}

export interface ReportRowProps {
  visit: ReportListItem
  /** Preformatted visit date (e.g. "Jul 9, 2026"). */
  dateLabel: string
}

/**
 * A single completed visit in the reports list: pool name + score badge, its
 * address, the servicing tech and date, and a chevron linking to the full
 * per-visit report.
 */
export function ReportRow({ visit, dateLabel }: ReportRowProps) {
  return (
    <Link
      href={`/visits/${visit.id}/report?from=/reports`}
      className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-base font-semibold text-card-foreground">
            {visit.poolName}
          </h3>
          <ScoreBadge score={visit.score} />
        </div>

        {visit.address ? (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{visit.address}</span>
          </p>
        ) : null}

        <p className="mt-1 text-xs text-muted-foreground">
          {dateLabel} · {visit.techName}
        </p>
      </div>

      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  )
}
