import { redirect } from "next/navigation"
import { format } from "date-fns"
import { Bell } from "lucide-react"

import { getCurrentUser } from "@/lib/auth"
import { getDashboardData } from "@/lib/db/dashboard"
import { Shell } from "@/components/ui/shell"
import { StatsRow } from "@/components/dashboard/StatsRow"
import { VisitCard } from "@/components/dashboard/VisitCard"
import { EmptyState } from "@/components/dashboard/EmptyState"
import { RefreshButton } from "@/components/dashboard/RefreshButton"
import { ScanFab } from "@/components/dashboard/ScanFab"

/** Time-of-day greeting from the server clock. */
function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

/** First name, for a friendlier greeting; falls back to the full name. */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }

  const { visits, stats } = await getDashboardData(user.companyId)
  const now = new Date()

  return (
    <>
      <Shell>
        <header className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
              {greeting(now)}, {firstName(user.name)}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {format(now, "EEEE, MMMM d")}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Notifications"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Bell className="size-4" />
            </button>
            <RefreshButton />
          </div>
        </header>

        <StatsRow stats={stats} />

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-foreground">
            Today&apos;s Visits
          </h2>

          {visits.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {visits.map((visit) => (
                <VisitCard key={visit.id} visit={visit} />
              ))}
            </div>
          )}
        </section>
      </Shell>

      <ScanFab />
    </>
  )
}
