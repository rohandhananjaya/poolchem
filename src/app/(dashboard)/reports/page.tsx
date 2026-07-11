import Link from "next/link"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { ChevronLeft, ChevronRight, FileText } from "lucide-react"

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
import { Button } from "@/components/ui/button"

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

  return (
    <Shell title="Reports">
      <div className="space-y-6">
        {/* Reports list with filters and pagination */}
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-foreground">
              {total > 0
                ? `Reports (${total})`
                : "Reports"}
            </h2>

            <ReportsFilters
              pools={pools.map((p) => ({ id: p.id, name: p.name }))}
            />
          </div>

          {recentVisits.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <FileText className="size-8" />
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">
                {total === 0
                  ? "No completed visits yet."
                  : "No reports match the current filters."}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {total === 0
                  ? "Reports appear here once your team completes service visits."
                  : "Try adjusting your filter criteria."}
              </p>
            </div>
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
                        href={`/reports?${buildQueryString(spForLinks, { page: String(currentPage - 1) })}`}
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
                            href={`/reports?${buildQueryString(spForLinks, { page: String(item) })}`}
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
                        href={`/reports?${buildQueryString(spForLinks, { page: String(currentPage + 1) })}`}
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
                Page {currentPage} of {totalPages} ({total} report{total !== 1 ? "s" : ""})
              </p>
            </>
          )}
        </section>
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
