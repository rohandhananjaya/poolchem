"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { Filter, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"

interface PoolOption {
  id: string
  name: string
}

export function ReportsFilters({ pools }: { pools: PoolOption[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentPool = searchParams.get("poolId") || ""
  const currentFrom = searchParams.get("fromDate") || ""
  const currentTo = searchParams.get("toDate") || ""

  const apply = useCallback(
    (formData: FormData) => {
      const params = new URLSearchParams()
      const poolId = formData.get("poolId") as string
      const fromDate = formData.get("fromDate") as string
      const toDate = formData.get("toDate") as string
      if (poolId) params.set("poolId", poolId)
      if (fromDate) params.set("fromDate", fromDate)
      if (toDate) params.set("toDate", toDate)
      params.set("page", "1")
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname],
  )

  const clear = useCallback(() => {
    router.push(pathname)
  }, [router, pathname])

  return (
    <form action={apply} className="flex flex-wrap items-end gap-3">
      <div>
        <label
          htmlFor="pool-filter"
          className="mb-1 block text-xs font-medium text-muted-foreground"
        >
          Pool
        </label>
        <select
          id="pool-filter"
          name="poolId"
          defaultValue={currentPool}
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
          name="fromDate"
          defaultValue={currentFrom}
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
          name="toDate"
          defaultValue={currentTo}
          className="h-8 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground"
        />
      </div>

      <Button type="submit" size="sm" variant="default">
        <Filter className="size-4" />
        Apply
      </Button>

      <Button type="button" size="sm" variant="ghost" onClick={clear}>
        <RotateCcw className="size-4" />
        Clear
      </Button>
    </form>
  )
}
