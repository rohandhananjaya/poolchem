"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut, User } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { UserRole } from "@/generated/prisma/client"

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Platform Administrator",
  OWNER: "Owner",
  TECH: "Technician",
}

/** Returns the first character(s) usable as an avatar/logo fallback. */
function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export interface UserMenuProps {
  user: { name: string; email: string; role: UserRole; image?: string | null }
}

/**
 * Account dropdown — avatar trigger with name/email, profile link, and sign
 * out. Rendered in the top bar next to the notification bell.
 */
export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter()
  const [signingOut, setSigningOut] = React.useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className={cn(
          "flex size-10 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-primary text-primary-foreground shadow-sm transition-colors",
          "hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        )}
      >
        <Avatar className="size-7">
          <AvatarImage src={user.image ?? undefined} alt={user.name} />
          <AvatarFallback className="text-[10px]">{initials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate">{user.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {user.email}
          </span>
          <span className="mt-1 inline-flex w-fit items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {ROLE_LABELS[user.role]}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings#profile" className="cursor-pointer">
            <User />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={signingOut}
          onSelect={(event) => {
            event.preventDefault()
            handleSignOut()
          }}
        >
          <LogOut />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
