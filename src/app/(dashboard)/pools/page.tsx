import Link from "next/link"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { ChevronLeft, ChevronRight, MapPin, Waves } from "lucide-react"

import { requireTech } from "@/lib/auth"
import { getPoolsPaginated, POOLS_PAGE_SIZE } from "@/lib/db/pools"
import type { PoolsFilters as PoolsFilterParams } from "@/lib/db/pools"
import { Shell } from "@/components/ui/shell"
import { Button } from "@/components/ui/button"
import { AddPoolDialog } from "@/components/pools/AddPoolDialog"
import { PoolActions } from "@/components/pools/PoolActions"
import { PoolsFilters } from "@/components/pools/PoolsFilters"

function buildQueryString(
  params: URLSearchParams,
  overrides: Record<string, string | undefined>,
): string {
  const next = new URLSearchParams(params)
  for (const [key, value] of Object.entries(overrides)) {
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
  }
  return next.toString()
}

export default async function PoolsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>
}) {
  const user = await requireTech()
  if (!user.companyId) {
    redirect("/admin")
  }

  const sp = await searchParams
  const currentPage = Math.max(1, Number(sp.page) || 1)

  const status = sp.status as PoolsFilterParams["status"] | undefined
  // Treat empty status as "active" (default)
  const effectiveStatus = !status || status === "active" ? "active" : status

  const filters: PoolsFilterParams = {
    search: sp.search || undefined,
    status: effectiveStatus,
  }

  const { pools, total } = await getPoolsPaginated(user.companyId, currentPage, filters)

  const totalPages = Math.ceil(total / POOLS_PAGE_SIZE)
  const spForLinks = new URLSearchParams()
  if (filters.search) spForLinks.set("search", filters.search)
  if (filters.status && filters.status !== "active") spForLinks.set("status", filters.status)

  return (
    <Shell title="Pools">
      <div className="space-y-3">
        {/* Top bar */}
        <div className="flex items-center justify-end">
          <AddPoolDialog />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <PoolsFilters />
        </div>

        <hr className="border-border" />

        {/* Pool list */}
        {pools.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Waves className="size-8" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">
              {total === 0
                ? "No pools yet."
                : "No pools match the current filters."}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {total === 0
                ? "Add a pool to start tracking water health."
                : "Try adjusting your filter criteria."}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {pools.map((pool) => {
                const isActive = pool.isActive
                return (
                  <div
                    key={pool.id}
                    className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-card-foreground">
                          {pool.name}
                        </h3>
                        {isActive ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Inactive
                          </span>
                        )}
                        <span className="font-mono text-xs text-muted-foreground">
                          {pool.volume.toLocaleString()} gal
                        </span>
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

                    <PoolActions pool={pool} />
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  asChild={currentPage > 1}
                >
                  {currentPage > 1 ? (
                    <Link
                      href={`/pools?${buildQueryString(spForLinks, { page: String(currentPage - 1) })}`}
                    >
                      <ChevronLeft className="size-4" />
                      Prev
                    </Link>
                  ) : (
                    <>
                      <ChevronLeft className="size-4" />
                      Prev
                    </>
                  )}
                </Button>

                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  {generatePageNumbers(currentPage, totalPages).map(
                    (item, i) =>
                      item === "..." ? (
                        <span key={`ellipsis-${i}`} className="px-1">
                          ...
                        </span>
                      ) : (
                        <Link
                          key={item}
                          href={`/pools?${buildQueryString(spForLinks, { page: String(item) })}`}
                          className={`inline-flex size-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                            item === currentPage
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {item}
                        </Link>
                      ),
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  asChild={currentPage < totalPages}
                >
                  {currentPage < totalPages ? (
                    <Link
                      href={`/pools?${buildQueryString(spForLinks, { page: String(currentPage + 1) })}`}
                    >
                      Next
                      <ChevronRight className="size-4" />
                    </Link>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="size-4" />
                    </>
                  )}
                </Button>
              </div>
            )}

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Page {currentPage} of {totalPages} ({total} pool{total !== 1 ? "s" : ""})
            </p>
          </>
        )}
      </div>
    </Shell>
  )
}

/** Collapses a long page range with ellipses: [1, "...", 5, 6, 7, "...", 20]. */
function generatePageNumbers(
  current: number,
  total: number,
): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | "...")[] = []
  const siblings = 1

  const rangeStart = Math.max(2, current - siblings)
  const rangeEnd = Math.min(total - 1, current + siblings)

  pages.push(1)

  if (rangeStart > 2) {
    pages.push("...")
  }

  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i)
  }

  if (rangeEnd < total - 1) {
    pages.push("...")
  }

  pages.push(total)

  return pages
}
