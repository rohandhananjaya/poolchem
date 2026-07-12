"use client"

import * as React from "react"
import Link from "next/link"
import { format } from "date-fns"
import { LayoutDashboard, MapPin } from "lucide-react"

import { ActiveBadge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EditPoolDialog } from "./EditPoolDialog"

interface PoolRowProps {
  pool: {
    id: string
    name: string
    volume: number
    address: string | null
    notes: string | null
    isActive: boolean
    lastVisitAt: Date | string | null
  }
  /** When false, the detail dialog is read-only (no edit/delete). */
  canManage?: boolean
}

export function PoolRow({ pool, canManage = false }: PoolRowProps) {
  const [open, setOpen] = React.useState(false)
  const isActive = pool.isActive

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen(true)
        }}
        className="flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-card-foreground">
              {pool.name}
            </h3>
            {<ActiveBadge active={isActive} />}
          </div>

          {pool.address ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{pool.address}</span>
            </p>
          ) : null}

          <p className="mt-1 text-xs text-muted-foreground">
            {pool.lastVisitAt
              ? `Last visit: ${format(new Date(pool.lastVisitAt), "MMM d, yyyy")}`
              : "No visits yet"}
          </p>
        </div>

        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button asChild variant="default" size="lg">
            <Link href={`/pools/${pool.id}`}>
              <LayoutDashboard className="size-4" />
              Analysis
            </Link>
          </Button>
        </div>
      </div>

      <EditPoolDialog
        pool={pool}
        canManage={canManage}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
