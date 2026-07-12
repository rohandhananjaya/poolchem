"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useFilterPush } from "@/hooks/use-filter-push"

interface PoolOption {
  id: string
  name: string
}

export function ReportsFilters({ pools }: { pools: PoolOption[] }) {
  const push = useFilterPush()
  const pathname = usePathname()
  const router = useRouter()

  const currentPool = useSearchParams().get("poolId") || ""
  const currentFrom = useSearchParams().get("fromDate") || ""
  const currentTo = useSearchParams().get("toDate") || ""

  const clear = () => router.push(pathname)

  return (
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
  )
}
