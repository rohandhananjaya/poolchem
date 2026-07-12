import { redirect } from "next/navigation"
import { format } from "date-fns"
import { FileText } from "lucide-react"

import { requireTech } from "@/lib/auth"
import {
  getCompanyReportData,
  REPORTS_PAGE_SIZE,
  type ReportFilters,
} from "@/lib/db/reports"
import { getPoolsByCompany } from "@/lib/db/pools"
import { Shell } from "@/components/ui/shell"
import { ReportRow } from "@/components/reports/ReportRow"
import { ReportsFilters } from "@/components/reports/ReportsFilters"
import { EmptyState } from "@/components/ui/empty-state"
import { Pagination } from "@/components/ui/pagination"
import { buildQueryString } from "@/lib/url"

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; poolId?: string; fromDate?: string; toDate?: string }>
}) {
  const user = await requireTech()
  if (!user.companyId) {
    redirect("/admin")
  }

  const sp = await searchParams
  const currentPage = Math.max(1, Number(sp.page) || 1)
  const filters: ReportFilters = {
    poolId: sp.poolId || undefined,
    fromDate: sp.fromDate || undefined,
    toDate: sp.toDate || undefined,
  }

  const [pools, { recentVisits, total }] = await Promise.all([
    getPoolsByCompany(user.companyId),
    getCompanyReportData(user.companyId, currentPage, filters),
  ])

  const totalPages = Math.ceil(total / REPORTS_PAGE_SIZE)
  const spForLinks = new URLSearchParams()
  if (filters.poolId) spForLinks.set("poolId", filters.poolId)
  if (filters.fromDate) spForLinks.set("fromDate", filters.fromDate)
  if (filters.toDate) spForLinks.set("toDate", filters.toDate)

  const buildHref = (page: number) =>
    `/reports?${buildQueryString(spForLinks, { page: String(page) })}`

  return (
    <Shell title="Reports">
      <div className="space-y-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <ReportsFilters
            pools={pools.map((p) => ({ id: p.id, name: p.name }))}
          />
        </div>

        <hr className="border-border" />

        {recentVisits.length === 0 ? (
            <EmptyState
              icon={<FileText className="size-8" />}
              title={total === 0 ? "No completed visits yet." : "No reports match the current filters."}
              description={total === 0 ? "Reports appear here once your team completes service visits." : "Try adjusting your filter criteria."}
            />
          ) : (
            <>
              <div className="space-y-3">
                {recentVisits.map((visit) => (
                  <ReportRow
                    key={visit.id}
                    visit={visit}
                    dateLabel={format(new Date(visit.date), "MMM d, yyyy")}
                  />
                ))}
              </div>

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                buildHref={buildHref}
                itemLabel="report"
                total={total}
              />
            </>
          )}
      </div>
    </Shell>
  )
}


