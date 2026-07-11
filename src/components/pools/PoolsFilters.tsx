"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"

export function PoolsFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [status, setStatus] = useState(searchParams.get("status") || "")

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (status && status !== "active") params.set("status", status)
      params.set("page", "1")
      router.push(`${pathname}?${params.toString()}`)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, status, router, pathname])

  const clear = () => router.push(pathname)

  return (
    <div className="flex flex-wrap items-end gap-3">
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
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-8 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground"
        >
          <option value="active">Active only</option>
          <option value="all">All</option>
          <option value="inactive">Inactive only</option>
        </select>
      </div>

      <Button type="button" size="icon-sm" variant="ghost" onClick={clear}>
        <RotateCcw className="size-4" />
      </Button>
    </div>
  )
}
