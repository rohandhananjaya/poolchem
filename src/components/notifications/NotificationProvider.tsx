"use client"

import * as React from "react"
import { formatDistanceToNow } from "date-fns"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  NotificationContext,
  useRealtimeVisits,
} from "@/hooks/use-realtime-visits"

export function NotificationProvider({
  userId,
  children,
}: {
  userId: string
  children: React.ReactNode
}) {
  const { newVisitAlert, notifications, unreadCount, dismissAlert, markAllRead, markRead } =
    useRealtimeVisits(userId)

  const ctx = React.useMemo(
    () => ({ notifications, unreadCount, markAllRead, markRead }),
    [notifications, unreadCount, markAllRead, markRead],
  )

  return (
    <NotificationContext.Provider value={ctx}>
      {children}

      {newVisitAlert && (
        <div className="fixed right-4 top-20 z-50 w-[calc(100%-2rem)] max-w-sm animate-in slide-in-from-right-5 fade-in duration-300">
          <Card className="border-l-4 border-l-brand-600">
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
    </NotificationContext.Provider>
  )
}
