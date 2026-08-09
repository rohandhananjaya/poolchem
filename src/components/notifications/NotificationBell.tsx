"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { Bell } from "lucide-react"

import { cn } from "@/lib/utils"
import { NotificationContext } from "@/hooks/use-realtime-visits"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Realtime notification bell + dropdown. Reads unread count from
 * `NotificationContext`; rendered in the app top bar.
 */
export function NotificationBell() {
  const { notifications, unreadCount, markAllRead, markRead } =
    React.useContext(NotificationContext)
  const router = useRouter()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            unreadCount > 0
              ? `Notifications (${unreadCount} unread)`
              : "Notifications"
          }
          className={cn(
            "relative inline-flex size-10 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            unreadCount > 0 && "animate-bell-ring",
          )}
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex size-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-bold leading-none text-white ring-2 ring-background animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="cursor-pointer text-xs font-medium text-brand-600 hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            No notifications yet
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                onSelect={() => {
                  markRead(n.id)
                  router.push(`/visits/${n.visitId}`)
                }}
                className="flex items-start gap-2 py-2"
              >
                {!n.read && (
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-600" />
                )}
                <div className={cn("min-w-0 flex-1", n.read && "pl-3.5")}>
                  <p className="truncate text-sm font-medium text-foreground">
                    {n.poolName}
                  </p>
                  {n.poolAddress && (
                    <p className="truncate text-xs text-muted-foreground">
                      {n.poolAddress}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDistanceToNow(n.assignedAt, { addSuffix: true })}
                  </p>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
