"use client"

import * as React from "react"
import { format, formatDistanceToNow } from "date-fns"
import { Bell, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RefreshButton } from "@/components/dashboard/RefreshButton"
import { useRealtimeVisits } from "@/hooks/use-realtime-visits"

interface DashboardHeaderProps {
  greeting: string
  name: string
  date: Date
  userId: string
}

export function DashboardHeader({ greeting, name, date, userId }: DashboardHeaderProps) {
  const { newVisitAlert, unreadCount, dismissAlert, markAllRead } =
    useRealtimeVisits(userId)

  return (
    <>
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
              "relative inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
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

      {newVisitAlert && (
        <div className="fixed right-4 top-4 z-50 w-[calc(100%-2rem)] max-w-sm animate-in slide-in-from-right-5 fade-in duration-300">
          <Card className="border-l-4 border-l-teal-600">
            <CardContent className="flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  New visit assigned
                </p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {newVisitAlert.poolName}
                </p>
                {newVisitAlert.poolAddress && (
                  <p className="text-xs text-muted-foreground">
                    {newVisitAlert.poolAddress}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDistanceToNow(newVisitAlert.assignedAt, { addSuffix: true })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Dismiss notification"
                onClick={dismissAlert}
                className="shrink-0"
              >
                <X className="size-3.5" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
