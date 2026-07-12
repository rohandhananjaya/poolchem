"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

import { cn } from "@/lib/utils"
import { StatTile } from "@/components/ui/stat-tile"
import { Button } from "@/components/ui/button"
import type { AdminDashboardData } from "@/lib/db/admin-dashboard"

export function PlatformKPIs({ data }: { data: AdminDashboardData }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  React.useEffect(() => {
    const id = setInterval(() => {
      startTransition(() => router.refresh())
    }, 30_000)
    return () => clearInterval(id)
  }, [router])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Platform Overview</p>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Refresh stats"
          disabled={pending}
          onClick={() => startTransition(() => router.refresh())}
        >
          <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <StatTile label="Companies" value={String(data.totalCompanies)} />
        <StatTile label="Users" value={String(data.totalUsers)} />
        <StatTile label="Active Pools" value={String(data.totalActivePools)} />
        <StatTile label="Total Visits" value={String(data.totalCompletedVisits)} />
        <StatTile label="Today Visits" value={String(data.todayCompletedVisits)} />
        <StatTile label="New Users Today" value={String(data.todayNewUsers)} />
        <StatTile label="New Companies Today" value={String(data.todayNewCompanies)} />
      </div>
    </div>
  )
}
