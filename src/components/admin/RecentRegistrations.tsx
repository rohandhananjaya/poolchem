"use client"

import { formatDistanceToNow } from "date-fns"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { RecentUser } from "@/lib/db/admin-dashboard"

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Platform Admin",
  OWNER: "Owner",
  TECH: "Technician",
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function RecentRegistrations({
  users,
}: {
  users: RecentUser[]
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-sm font-medium text-card-foreground">
        Recent Sign-ups
      </p>
      <div className="space-y-3">
        {users.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No recent sign-ups.
          </p>
        ) : (
          users.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3"
            >
              <Avatar className="size-8">
                <AvatarFallback className="text-[10px]">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-card-foreground">
                  {user.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              </div>
              <div className="hidden shrink-0 text-right sm:block">
                <p className="text-xs text-muted-foreground">
                  {user.companyName ?? "Platform"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(user.createdAt, { addSuffix: true })}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
