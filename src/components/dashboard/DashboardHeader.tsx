"use client"

import * as React from "react"
import { format } from "date-fns"
import { Bell } from "lucide-react"

import { cn } from "@/lib/utils"
import { RefreshButton } from "@/components/dashboard/RefreshButton"
import { NotificationContext } from "@/hooks/use-realtime-visits"

interface DashboardHeaderProps {
  greeting: string
  name: string
  date: Date
  userId: string
}

export function DashboardHeader({ greeting, name, date }: DashboardHeaderProps) {
  const { unreadCount, markAllRead } = React.useContext(NotificationContext)

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
        <button
          type="button"
          aria-label={
            unreadCount > 0
              ? `Notifications (${unreadCount} unread)`
              : "Notifications"
          }
          onClick={markAllRead}
          className={cn(
            "relative inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            unreadCount > 0 && "animate-bell-ring",
          )}
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex size-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-bold leading-none text-destructive-foreground animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
        <RefreshButton />
      </div>
    </header>
  )
}
