"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Activity,
  Building2,
  Calendar,
  FileText,
  House,
  LogOut,
  Shield,
  User,
  Users,
  Waves,
  type LucideIcon,
} from "lucide-react"

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

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Roles that can see this item. Empty array = all authenticated users. */
  roles?: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/schedule", label: "Schedule", icon: Calendar, roles: ["OWNER", "TECH"] },
  { href: "/reports", label: "Reports", icon: FileText, roles: ["OWNER", "TECH"] },
  { href: "/pools", label: "Pools", icon: Waves, roles: ["OWNER", "TECH"] },
  { href: "/team", label: "Team", icon: Users, roles: ["OWNER"] },
  { href: "/admin/companies", label: "Companies", icon: Building2, roles: ["SUPER_ADMIN"] },
  { href: "/admin/users", label: "Users", icon: Users, roles: ["SUPER_ADMIN"] },
  { href: "/admin/diagnostics", label: "Diagnostics", icon: Activity, roles: ["SUPER_ADMIN"] },
  { href: "/profile", label: "Profile", icon: User },
]

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Platform Administrator",
  OWNER: "Owner",
  TECH: "Technician",
}

export interface MainNavProps {
  user: { name: string; email: string; role: UserRole; image?: string | null }
  company: { name: string; logo: string | null }
}

/** Returns the first character(s) usable as an avatar/logo fallback. */
function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** A path is active when it matches exactly or is an ancestor of the pathname. */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/")
}

export function MainNav({ user, company }: MainNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, setSigningOut] = React.useState(false)

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user.role),
  )

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <>
      {/* Desktop: left sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex print:hidden">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <Avatar className="size-9 rounded-lg">
            {company.logo ? (
              <AvatarImage src={company.logo} alt={company.name} />
            ) : null}
            <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              {initials(company.name)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-sm font-semibold" title={company.name}>
            {company.name}
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {visibleItems.map((item) => {
            const active = isActive(pathname, item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <UserMenu
            user={user}
            signingOut={signingOut}
            onSignOut={handleSignOut}
          />
        </div>
      </aside>

      {/* Mobile: bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden print:hidden">
        {visibleItems.map((item) => {
          const active = isActive(pathname, item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                // min-h-14 (56px) keeps the tap target well above the 48px
                // minimum; the label stays text-xs (icon size unchanged).
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-5 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}

function UserMenu({
  user,
  signingOut,
  onSignOut,
}: {
  user: { name: string; email: string; role: UserRole; image?: string | null }
  signingOut: boolean
  onSignOut: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left text-sm outline-none transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          "focus-visible:ring-3 focus-visible:ring-sidebar-ring/50"
        )}
      >
        <Avatar>
          <AvatarImage src={user.image ?? undefined} alt={user.name} />
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {user.email}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
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
        <DropdownMenuItem
          variant="destructive"
          disabled={signingOut}
          onSelect={(event) => {
            event.preventDefault()
            onSignOut()
          }}
        >
          <LogOut />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
