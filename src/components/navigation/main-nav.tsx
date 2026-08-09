"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import {
  Activity,
  Building2,
  Calendar,
  FileText,
  House,
  MessageSquare,
  Settings,
  Shield,
  Users,
  Waves,
  type LucideIcon,
} from "lucide-react"

import { PRIVACY_URL, TERMS_URL } from "@/lib/config"
import { cn } from "@/lib/utils"
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
  { href: "/admin/packages", label: "Packages", icon: Shield, roles: ["SUPER_ADMIN"] },
  { href: "/admin/companies", label: "Companies", icon: Building2, roles: ["SUPER_ADMIN"] },
  { href: "/admin/users", label: "Users", icon: Users, roles: ["SUPER_ADMIN"] },
  { href: "/admin/diagnostics", label: "Diagnostics", icon: Activity, roles: ["SUPER_ADMIN"] },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquare, roles: ["SUPER_ADMIN"] },
  { href: "/settings", label: "Settings", icon: Settings },
]

export interface MainNavProps {
  user: { name: string; email: string; role: UserRole; image?: string | null }
  company: { name: string; logo: string | null }
  companyPackage?: { package: { name: string } | null; status: string; trialEnd: Date | null; paidAt: Date | null }
}

/** A path is active when it matches exactly or is an ancestor of the pathname. */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/")
}

/**
 * Tracks whether the bottom tab bar has enough room to show every label.
 *
 * Each tab is a `flex-1` slot of equal width, so labels only fit without
 * touching their neighbours when the WIDEST label fits inside one slot. A
 * small per-item cushion keeps them from feeling cramped. Label widths are
 * cached once measured while visible and only re-measured when a label is
 * actually laid out (offsetWidth > 0), keeping the check stable across
 * re-renders — e.g. React StrictMode double-invoking the effect after labels
 * have been hidden — and across rotations.
 */
const LABEL_CUSHION = 8 // px of breathing room per item (4px each side)

function useTabLabelsFit(count: number) {
  const containerRef = React.useRef<HTMLElement>(null)
  const labelRefs = React.useRef<(HTMLSpanElement | null)[]>([])
  const widthsRef = React.useRef<number[] | null>(null)
  const [showLabels, setShowLabels] = React.useState(true)

  React.useEffect(() => {
    const nav = containerRef.current
    if (!nav || count === 0) return

    const apply = () => {
      const widths = widthsRef.current ?? (widthsRef.current = [])
      labelRefs.current.forEach((el, index) => {
        if (el && el.offsetWidth > 0) widths[index] = el.offsetWidth
      })
      const widest = widths.reduce((max, width) => Math.max(max, width), 0)
      const required = count * (widest + LABEL_CUSHION)
      setShowLabels(required <= nav.clientWidth)
    }

    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(nav)
    return () => observer.disconnect()
  }, [count])

  return { containerRef, labelRefs, showLabels }
}

export function MainNav({ user, company: _company, companyPackage }: MainNavProps) {
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user.role),
  )

  const { containerRef: tabBarRef, labelRefs, showLabels } = useTabLabelsFit(visibleItems.length)

  return (
    <>
      {/* Desktop: left sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex print:hidden">
        <div className="flex h-16 flex-col items-center justify-center border-b border-sidebar-border px-3 py-3" suppressHydrationWarning>
          <div className="w-fit">
            <Link href="/dashboard" className="flex items-center justify-center">
              <Image
                src="/images/POOLBENCH.png"
                alt="Poolbench"
                width={100}
                height={28}
                className="h-auto w-auto"
                priority
              />
            </Link>
            {companyPackage ? <PackageSidebarBadge companyPackage={companyPackage} /> : null}
          </div>
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

        <div className="border-t border-sidebar-border px-3 py-2" suppressHydrationWarning>
          <div className="flex items-center justify-center gap-3 text-xs text-sidebar-foreground/50" suppressHydrationWarning>
            <Link href={PRIVACY_URL} className="hover:text-sidebar-foreground/90 transition-colors">
              Privacy
            </Link>
            <Link href={TERMS_URL} className="hover:text-sidebar-foreground/90 transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile: bottom tab bar */}
      <nav
        ref={tabBarRef}
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
      >
        {visibleItems.map((item, index) => {
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
              <span
                ref={(el) => {
                  labelRefs.current[index] = el
                }}
                className={cn(
                  "whitespace-nowrap",
                  !showLabels && "hidden"
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}

function PackageSidebarBadge({
  companyPackage,
}: {
  companyPackage: { package: { name: string } | null; status: string; trialEnd: Date | null; paidAt: Date | null }
}) {
  const isTrial = companyPackage.status === "TRIAL"
  const isExpired = companyPackage.status === "EXPIRED"
  const isActive = companyPackage.status === "ACTIVE"
  const colorClass = isActive
    ? "text-emerald-600 dark:text-emerald-400"
    : isTrial
      ? "text-amber-600 dark:text-amber-400"
      : isExpired
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground"

  const statusLabel = isTrial ? "Trial" : isActive ? "Active" : isExpired ? "Expired" : "Cancelled"
  const planName = isTrial ? "Free Trial" : (companyPackage.package?.name ?? "Free Trial")

  return (
    <Link
      href="/account/package"
      className={`flex w-full items-center justify-end gap-1 text-[8px] font-medium uppercase tracking-wide transition-colors hover:opacity-80 ${colorClass}`}
    >
      {planName}
      {!isActive && <span>({statusLabel})</span>}
    </Link>
  )
}
