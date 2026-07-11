"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { Filter, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"

export function PoolsFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentSearch = searchParams.get("search") || ""
  const currentStatus = searchParams.get("status") || ""

  const apply = useCallback(
    (formData: FormData) => {
      const params = new URLSearchParams()
      const search = formData.get("search") as string
      const status = formData.get("status") as string
      if (search) params.set("search", search)
      if (status && status !== "active") params.set("status", status)
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
          htmlFor="pool-search"
          className="mb-1 block text-xs font-medium text-muted-foreground"
        >
          Search
        </label>
        <input
          id="pool-search"
          type="search"
          name="search"
          defaultValue={currentSearch}
          placeholder="Name or address…"
          className="h-8 w-48 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground"
        />
      </div>

      <div>
        <label
          htmlFor="pool-status"
          className="mb-1 block text-xs font-medium text-muted-foreground"
        >
          Status
        </label>
        <select
          id="pool-status"
          name="status"
          defaultValue={currentStatus}
          className="h-8 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground"
        >
          <option value="active">Active only</option>
          <option value="all">All</option>
          <option value="inactive">Inactive only</option>
        </select>
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
