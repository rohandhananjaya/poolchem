import { redirect } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { Bell, LayoutDashboard } from "lucide-react"

import { requireActivePackage } from "@/lib/auth"
import { getCompanyById } from "@/lib/db/company"
import { getDashboardData } from "@/lib/db/dashboard"
import { getAdminDashboardData } from "@/lib/db/admin-dashboard"
import { getServerHealthSummary } from "@/lib/db/admin-diagnostics"
import { getFeeSavingsData } from "@/lib/db/fee-savings"
import { Shell } from "@/components/ui/shell"
import { Card, CardContent } from "@/components/ui/card"
import { CompanyLogo } from "@/components/shared/CompanyLogo"
import { RealtimeVisitsRefresh } from "@/components/shared/RealtimeVisitsRefresh"
import { DashboardHeader } from "@/components/dashboard/DashboardHeader"
import { StatsRow } from "@/components/dashboard/StatsRow"
import { VisitCard } from "@/components/visits/VisitCard"
import { EmptyState } from "@/components/dashboard/EmptyState"
import { ScanFab } from "@/components/dashboard/ScanFab"
import { PlatformKPIs } from "@/components/admin/PlatformKPIs"
import { ServerHealthSummary } from "@/components/admin/ServerHealthSummary"
import { LiveServerCharts } from "@/components/admin/LiveServerCharts"
import { FeeSavingsCard } from "@/components/admin/FeeSavingsCard"
import type { UserRole } from "@/generated/prisma/client"

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
  const user = await requireActivePackage()

  // SUPER_ADMIN has no company — show a platform overview instead.
  if (user.role === "SUPER_ADMIN" as UserRole) {
    return <SuperAdminDashboard name={user.name} />
  }

  const companyId = user.companyId!
  const company = await getCompanyById(companyId)
  const { visits, stats } = await getDashboardData(companyId)
  const now = new Date()

  return (
    <>
      <Shell>
        <Card className="mb-6">
          <CardContent className="flex items-center gap-3 py-2">
            {company?.logo && (
              <CompanyLogo
                src={company.logo}
                alt={company.name ?? "Company"}
                size={48}
                className="shrink-0"
              />
            )}
            <p className="truncate text-base font-semibold text-foreground">
              {company?.name ?? "—"}
            </p>
          </CardContent>
        </Card>

        <DashboardHeader
          greeting={greeting(now)}
          name={firstName(user.name)}
          date={now}
          userId={user.id}
        />

        <StatsRow
          stats={stats}
          today={format(now, "yyyy-MM-dd")}
          tomorrow={format(new Date(now.getTime() + 86400000), "yyyy-MM-dd")}
        />

        <section id="today-visits" className="mt-8">
          <h2 className="mb-3 text-base font-semibold text-foreground">
            Today&apos;s Visits
          </h2>

          {visits.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {visits.map((visit) => (
                <VisitCard key={visit.id} visit={visit} currentUserId={user.id} />
              ))}
            </div>
          )}
        </section>
      </Shell>

      <RealtimeVisitsRefresh />
      <ScanFab />
    </>
  )
}

/** Full realtime dashboard for SUPER_ADMIN users. */
async function SuperAdminDashboard({ name }: { name: string }) {
  const now = new Date()
  const [data, health, feeSavings] = await Promise.all([
    getAdminDashboardData(),
    getServerHealthSummary(),
    getFeeSavingsData(),
  ])

  return (
    <Shell>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
            {greeting(now)}, {firstName(name)}
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
          <Link
            href="/admin"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted"
            aria-label="Admin panel"
          >
            <LayoutDashboard className="size-4" />
          </Link>
        </div>
      </header>

      <PlatformKPIs data={data} />

      <div className="mt-6">
        <FeeSavingsCard data={feeSavings} />
      </div>

      <div className="mt-6">
        <LiveServerCharts />
      </div>

      <div className="mt-6">
        <ServerHealthSummary server={health.server} logSummary={health.logSummary} />
      </div>
    </Shell>
  )
}
