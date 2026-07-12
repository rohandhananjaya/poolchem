import Link from "next/link"
import { ChevronRight, MapPin } from "lucide-react"

import { HealthBadge } from "@/components/ui/badge"
import type { ReportListItem } from "@/lib/db/reports"

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
          <HealthBadge score={visit.score} />
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
