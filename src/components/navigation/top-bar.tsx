import { NotificationBell } from "@/components/notifications/NotificationBell"
import { UserMenu } from "@/components/navigation/user-menu"
import type { UserRole } from "@/generated/prisma/client"

export interface TopBarProps {
  user: { name: string; email: string; role: UserRole; image?: string | null }
}

/**
 * Global fixed top bar. Notification bell + account menu pinned to the far
 * right end; matches the sidebar's chrome (same `bg-sidebar` surface +
 * `h-16` logo-section height) so its bottom border lines up with the sidebar
 * divider. Spans the content area on desktop (offsets the fixed sidebar) and
 * the full width on mobile.
 */
export function TopBar({ user }: TopBarProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 h-16 border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:left-64 print:hidden">
      <div className="flex h-full items-center justify-end gap-2 px-4 md:px-6">
        <NotificationBell />
        <UserMenu user={user} />
      </div>
    </header>
  )
}
