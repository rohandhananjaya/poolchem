import { redirect } from "next/navigation"
import { Waves } from "lucide-react"

import { requireTech } from "@/lib/auth"
import { getPoolsPaginated, POOLS_PAGE_SIZE } from "@/lib/db/pools"
import type { PoolsFilters as PoolsFilterParams } from "@/lib/db/pools"
import { Shell } from "@/components/ui/shell"
import { AddPoolDialog } from "@/components/pools/AddPoolDialog"
import { PoolRow } from "@/components/pools/PoolRow"
import { PoolsFilters } from "@/components/pools/PoolsFilters"
import { EmptyState } from "@/components/ui/empty-state"
import { Pagination } from "@/components/ui/pagination"
import { buildQueryString } from "@/lib/url"

export default async function PoolsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>
}) {
  const user = await requireTech()
  if (!user.companyId) {
    redirect("/admin")
  }

  const canManage = user.role === "OWNER" || user.role === "SUPER_ADMIN"

  const sp = await searchParams
  const currentPage = Math.max(1, Number(sp.page) || 1)

  const status = sp.status as PoolsFilterParams["status"] | undefined
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

  const buildHref = (page: number) =>
    `/pools?${buildQueryString(spForLinks, { page: String(page) })}`

  return (
    <Shell title="Pools">
      <div className="space-y-3">
        {canManage && (
          <div className="flex items-center justify-end">
            <AddPoolDialog />
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4">
          <PoolsFilters />
        </div>

        <hr className="border-border" />

        {pools.length === 0 ? (
          <EmptyState
            icon={<Waves className="size-8" />}
            title={total === 0 ? "No pools yet." : "No pools match the current filters."}
            description={total === 0 ? "Add a pool to start tracking water health." : "Try adjusting your filter criteria."}
          />
        ) : (
          <>
            <div className="space-y-3">
              {pools.map((pool) => (
                <PoolRow key={pool.id} pool={pool} canManage={canManage} />
              ))}
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              buildHref={buildHref}
              itemLabel="pool"
              total={total}
            />
          </>
        )}
      </div>
    </Shell>
  )
}


