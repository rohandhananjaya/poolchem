"use client"

import { format } from "date-fns"

import { RefreshButton } from "@/components/dashboard/RefreshButton"

interface DashboardHeaderProps {
  greeting: string
  name: string
  date: Date
  userId: string
}

export function DashboardHeader({ greeting, name, date }: DashboardHeaderProps) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
          {greeting}, {name}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {format(date, "EEEE, MMMM d")}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <RefreshButton />
      </div>
    </header>
  )
}
