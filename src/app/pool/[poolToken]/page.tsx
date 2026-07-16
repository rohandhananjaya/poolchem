import { notFound } from "next/navigation"
import { format, formatDistanceToNow, isPast } from "date-fns"
import {
  CalendarCheck,
  CalendarClock,
  Droplets,
  Sparkles,
  Waves,
} from "lucide-react"

import {
  getHomeownerDashboard,
  type HomeownerActivity,
} from "@/lib/reports/homeowner-dashboard"
import type { WaterHealthStatus } from "@/lib/pool-chemistry"
import { cn } from "@/lib/utils"
import { WaterHealthGauge } from "@/components/visits/WaterHealthGauge"
import { ScoreSparkline } from "@/components/reports/ScoreSparkline"
import { ShareButton } from "@/components/homeowner/share-button"

// Public dashboards are re-read on each request so a homeowner always sees the
// latest service; nothing here is user-specific or cacheable across pools.
export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ poolToken: string }>
}) {
  const { poolToken } = await params
  const dashboard = await getHomeownerDashboard(poolToken)
  if (!dashboard) return { title: "Pool Dashboard | Poolbench" }
  return {
    title: `${dashboard.pool.name} — Pool Dashboard | Poolbench`,
    description: `Water health and service history for ${dashboard.pool.name}, managed by ${dashboard.company.name}.`,
    openGraph: {
      title: `${dashboard.pool.name} — Pool Dashboard | Poolbench`,
      description: `Water health and service history for ${dashboard.pool.name}, managed by ${dashboard.company.name}.`,
      url: `/pool/${poolToken}`,
    },
    alternates: { canonical: `/pool/${poolToken}` },
    robots: { index: false, follow: false },
  }
}

/** Initials fallback for a missing logo. */
function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const STATUS_LABEL: Record<WaterHealthStatus, string> = {
  EXCELLENT: "Excellent",
  GOOD: "Good",
  FAIR: "Fair",
  POOR: "Needs attention",
}

/** Friendly, one-line summary shown under the gauge. */
const STATUS_HEADLINE: Record<WaterHealthStatus, string> = {
  EXCELLENT: "Your water is crystal clear and perfectly balanced.",
  GOOD: "Your water is in good shape and ready to enjoy.",
  FAIR: "Your water is okay — a few things are being kept in check.",
  POOR: "Your service team is working to bring your water back to ideal.",
}

/** Badge colors for a timeline entry's score. */
function statusBadge(status: WaterHealthStatus): string {
  switch (status) {
    case "EXCELLENT":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
    case "GOOD":
      return "bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-300"
    case "FAIR":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
    case "POOR":
      return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
  }
}

function TimelineRow({ activity }: { activity: HomeownerActivity }) {
  const date = new Date(activity.date)
  return (
    <li className="flex items-center gap-4 py-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400">
        <Droplets className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {format(date, "MMMM d, yyyy")}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          Serviced by {activity.techName}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
          statusBadge(activity.status),
        )}
      >
        {activity.score} · {STATUS_LABEL[activity.status]}
      </span>
    </li>
  )
}

/** A labelled date tile (Last Serviced / Upcoming Service). */
function DateTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}

export default async function HomeownerDashboardPage({
  params,
}: {
  params: Promise<{ poolToken: string }>
}) {
  const { poolToken } = await params
  const dashboard = await getHomeownerDashboard(poolToken)
  if (!dashboard) notFound()

  const { pool, company, waterHealth, lastServiced, nextService } = dashboard

  const lastServicedDate = lastServiced ? new Date(lastServiced) : null
  const nextServiceDate = nextService ? new Date(nextService) : null
  const nextIsOverdue = nextServiceDate ? isPast(nextServiceDate) : false

  return (
    <main className="min-h-full bg-gradient-to-b from-sky-50 via-cyan-50/40 to-background dark:from-slate-950 dark:via-slate-950 dark:to-background">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
        {/* Company chip */}
        <div className="mb-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {company.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logo}
              alt={company.name}
              className="size-6 rounded-md object-cover"
            />
          ) : (
            <Droplets className="size-4 text-teal-600" />
          )}
          <span>
            Managed by{" "}
            <span className="font-medium text-foreground">{company.name}</span>
          </span>
        </div>

        {/* Hero card */}
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          {pool.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pool.image}
              alt={pool.name}
              className="h-44 w-full object-cover sm:h-56"
            />
          ) : (
            <div className="flex h-32 w-full items-center justify-center bg-gradient-to-br from-teal-400 to-cyan-500 sm:h-40">
              <Waves className="size-12 text-white/80" />
            </div>
          )}

          <div className="p-6 sm:p-8">
            <h1 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {pool.name}
            </h1>

            {waterHealth ? (
              <div className="mt-6 flex flex-col items-center gap-4">
                <WaterHealthGauge
                  score={waterHealth.score}
                  status={waterHealth.status}
                />
                <p className="max-w-sm text-center text-sm text-muted-foreground">
                  {STATUS_HEADLINE[waterHealth.status]}
                </p>
              </div>
            ) : (
              <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-muted/50 p-8 text-center">
                <Sparkles className="size-8 text-teal-500" />
                <p className="text-sm font-medium text-foreground">
                  Your dashboard is ready
                </p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Water health will appear here after {company.name}&rsquo;s
                  first service visit.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Service dates */}
        {(lastServicedDate || nextServiceDate) && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {lastServicedDate && (
              <DateTile
                icon={<CalendarCheck className="size-5" />}
                label="Last Serviced"
                value={format(lastServicedDate, "MMMM d, yyyy")}
                hint={formatDistanceToNow(lastServicedDate, { addSuffix: true })}
              />
            )}
            {nextServiceDate && (
              <DateTile
                icon={<CalendarClock className="size-5" />}
                label="Upcoming Service"
                value={format(nextServiceDate, "MMMM d, yyyy")}
                hint={
                  nextIsOverdue
                    ? "Due now — being scheduled"
                    : `Estimated · ${formatDistanceToNow(nextServiceDate, {
                        addSuffix: true,
                      })}`
                }
              />
            )}
          </div>
        )}

        {/* Trend */}
        {dashboard.scoreHistory.length > 0 && (
          <section className="mt-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">
                Water Health Over Time
              </h2>
              <span className="text-xs text-muted-foreground">
                Last {dashboard.scoreHistory.length} visit
                {dashboard.scoreHistory.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="mt-3">
              <ScoreSparkline points={dashboard.scoreHistory} />
            </div>
          </section>
        )}

        {/* Recent activity */}
        {dashboard.timeline.length > 0 && (
          <section className="mt-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">
              Recent Activity
            </h2>
            <ul className="mt-1 divide-y divide-border">
              {dashboard.timeline.map((activity) => (
                <TimelineRow key={activity.id} activity={activity} />
              ))}
            </ul>
          </section>
        )}

        {/* Share */}
        <div className="mt-6 flex justify-center">
          <ShareButton url={dashboard.shareUrl} poolName={pool.name} />
        </div>

        {/* Footer */}
        <footer className="mt-10 flex flex-col items-center gap-3 border-t border-border pt-6 text-center">
          <div className="flex items-center gap-2">
            {company.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logo}
                alt={company.name}
                className="size-8 rounded-lg object-cover"
              />
            ) : (
              <div className="flex size-8 items-center justify-center rounded-lg bg-teal-600 text-xs font-semibold text-white">
                {initials(company.name)}
              </div>
            )}
            <p className="text-sm font-semibold text-foreground">
              Managed by {company.name}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {[
              company.phone,
              company.email ? company.email : null,
            ]
              .filter(Boolean)
              .map((detail, i) => (
                <span key={i}>
                  {i > 0 && <span className="mx-1.5">·</span>}
                  {detail}
                </span>
              ))}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Droplets className="size-3 text-teal-500" />
            Powered by Poolbench
          </p>
        </footer>
      </div>
    </main>
  )
}
