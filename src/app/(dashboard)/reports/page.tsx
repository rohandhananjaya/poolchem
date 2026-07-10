import { redirect } from "next/navigation"
import { format } from "date-fns"
import { FileText } from "lucide-react"

import { requireTech } from "@/lib/auth"
import { getCompanyReportData } from "@/lib/db/reports"
import { Shell } from "@/components/ui/shell"
import { ScoreSparkline } from "@/components/reports/ScoreSparkline"
import { ReportRow } from "@/components/reports/ReportRow"

/** A headline metric tile, matching the dashboard's StatTile styling. */
function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-card-foreground">
        {value}
      </p>
    </div>
  )
}

export default async function ReportsPage() {
  const user = await requireTech()
  if (!user.companyId) {
    redirect("/admin")
  }

  const { stats, trend, recentVisits } = await getCompanyReportData(
    user.companyId,
  )

  return (
    <Shell title="Reports">
      <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Avg Water Health"
          value={
            stats.averageWaterHealth === null
              ? "—"
              : String(stats.averageWaterHealth)
          }
        />
        <StatTile label="Visits This Month" value={String(stats.visitsThisMonth)} />
        <StatTile label="Active Pools" value={String(stats.totalPools)} />
      </div>

      {/* Trend */}
      <section className="rounded-xl border border-border bg-card p-4 md:p-6">
        <h2 className="mb-3 text-sm font-medium text-foreground">
          Water Health Trend
        </h2>
        <div className="text-teal-500">
          <ScoreSparkline points={trend} width={640} height={80} />
        </div>
      </section>

      {/* Recent reports */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-foreground">
          Recent Reports
        </h2>

        {recentVisits.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FileText className="size-8" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">
              No completed visits yet.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Reports appear here once your team completes service visits.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentVisits.map((visit) => (
              <ReportRow
                key={visit.id}
                visit={visit}
                dateLabel={format(new Date(visit.date), "MMM d, yyyy")}
              />
            ))}
          </div>
        )}
      </section>
      </div>
    </Shell>
  )
}
