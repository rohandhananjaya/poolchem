"use client"

import { Wifi, WifiOff } from "lucide-react"

import { useOnlineStatus } from "@/hooks/use-online-status"
import { cn } from "@/lib/utils"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import { UserMenu } from "@/components/navigation/user-menu"
import type { UserRole } from "@/generated/prisma/client"

export interface TopBarProps {
  user: { name: string; email: string; role: UserRole; image?: string | null }
}

/**
 * Connection indicator. Rendered invisible until hydration supersedes the
 * optimistic `online` snapshot, so the pill never flashes the wrong state.
 */
function ConnectionStatus() {
  const { online, hydrated } = useOnlineStatus()

  return (
    <span
      aria-live="polite"
      title={online ? "You are online" : "You are offline — changes are saved on this device and sync when you reconnect"}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full border transition-colors",
        !hydrated && "invisible",
        hydrated && online &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        hydrated && !online &&
          "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      )}
    >
      {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
    </span>
  )
}

/**
 * Global fixed top bar. Connection status on the left; notification bell +
 * account menu pinned to the far right. Matches the sidebar's chrome (same
 * `bg-sidebar` surface + `h-16` logo-section height) so its bottom border
 * lines up with the sidebar divider. Spans the content area on desktop
 * (offsets the fixed sidebar) and the full width on mobile.
 */
export function TopBar({ user }: TopBarProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 h-16 border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:left-64 print:hidden">
      <div className="flex h-full items-center justify-end px-4 md:px-6">
        <ConnectionStatus />
        <div className="ml-4 flex items-center gap-2">
          <NotificationBell />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  )
}
