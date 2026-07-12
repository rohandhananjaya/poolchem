"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useFilterPush } from "@/hooks/use-filter-push"

interface PoolOption {
  id: string
  name: string
}

export function ScheduleFilters({ pools }: { pools: PoolOption[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const push = useFilterPush()

  const currentPool = searchParams.get("poolId") || ""
  const currentFrom = searchParams.get("fromDate") || ""
  const currentTo = searchParams.get("toDate") || ""
  const currentTab = searchParams.get("tab") || "scheduled"

  const clear = useCallback(() => {
    router.push(pathname)
  }, [router, pathname])

  const onTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === "scheduled") {
        params.delete("tab")
      } else {
        params.set("tab", value)
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="pool-filter"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            Pool
          </label>
          <select
            id="pool-filter"
            value={currentPool}
            onChange={(e) => push({ poolId: e.target.value || null })}
            className="h-8 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground"
          >
            <option value="">All pools</option>
            {pools.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="from-date"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            From
          </label>
          <input
            id="from-date"
            type="date"
            value={currentFrom}
            onChange={(e) => push({ fromDate: e.target.value || null })}
            className="h-8 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground"
          />
        </div>

        <div>
          <label
            htmlFor="to-date"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            To
          </label>
          <input
            id="to-date"
            type="date"
            value={currentTo}
            onChange={(e) => push({ toDate: e.target.value || null })}
            className="h-8 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground"
          />
        </div>

        <Button type="button" size="icon-sm" variant="ghost" onClick={clear}>
          <RotateCcw className="size-4" />
        </Button>
      </div>

      <div>
        <label
          htmlFor="status-filter"
          className="mb-1 block text-xs font-medium text-muted-foreground"
        >
          Status
        </label>
        <select
          id="status-filter"
          value={currentTab}
          onChange={(e) => onTabChange(e.target.value)}
          className="h-8 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground"
        >
          <option value="scheduled">Scheduled</option>
          <option value="all">All</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
    </div>
  )
}
