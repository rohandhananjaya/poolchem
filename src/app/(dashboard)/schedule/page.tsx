import Link from "next/link"
import { redirect } from "next/navigation"
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react"
import { format, isPast, isThisWeek, isToday, isTomorrow } from "date-fns"

import { requireTech } from "@/lib/auth"
import {
  getScheduleData,
  SCHEDULE_PAGE_SIZE,
  type ScheduledVisit,
  type ScheduleFilters,
} from "@/lib/db/schedule"
import { getPoolsByCompany } from "@/lib/db/pools"
import { getCompanyTechs } from "@/lib/db/users"
import { Shell } from "@/components/ui/shell"
import { Button } from "@/components/ui/button"
import { ScheduleVisitForm } from "@/components/schedule/ScheduleVisitForm"
import { ScheduleVisitCard } from "@/components/schedule/ScheduleVisitCard"
import { ScheduleFilters as ScheduleFiltersComponent } from "@/components/schedule/ScheduleFilters"

/** Ordered schedule buckets. */
const BUCKET_ORDER = [
  "overdue",
  "today",
  "tomorrow",
  "thisWeek",
  "later",
  "earlier",
] as const
type BucketKey = (typeof BUCKET_ORDER)[number]

const BUCKET_TITLES: Record<BucketKey, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  thisWeek: "This Week",
  later: "Later",
  earlier: "Earlier",
}

/** Places a visit into a schedule bucket by its effective date and status. */
function bucketOf(visit: ScheduledVisit): BucketKey {
  const date = new Date(visit.effectiveDate)
  if (isToday(date)) return "today"
  if (isPast(date)) {
    // Past visits: still-open ones are overdue; completed ones are history.
    return visit.status === "DRAFT" ? "overdue" : "earlier"
  }
  if (isTomorrow(date)) return "tomorrow"
  if (isThisWeek(date)) return "thisWeek"
  return "later"
}

/** Groups visits into the ordered buckets, sorted sensibly within each. */
function groupVisits(
  visits: ScheduledVisit[],
): Array<{ key: BucketKey; title: string; visits: ScheduledVisit[] }> {
  const groups = new Map<BucketKey, ScheduledVisit[]>()
  for (const visit of visits) {
    const key = bucketOf(visit)
    const list = groups.get(key) ?? []
    list.push(visit)
    groups.set(key, list)
  }

  return BUCKET_ORDER.filter((key) => groups.has(key)).map((key) => {
    const list = groups.get(key)!
    // History (overdue/earlier) reads newest-first; upcoming reads soonest-first.
    const descending = key === "overdue" || key === "earlier"
    list.sort((a, b) => {
      const diff =
        new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime()
      return descending ? -diff : diff
    })
    return { key, title: BUCKET_TITLES[key], visits: list }
  })
}

/** Builds a query string from search params, overriding specific keys. */
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

/** Date label for a visit card. We only capture a day, so no time is shown. */
function timeLabelFor(visit: ScheduledVisit): string {
  if (!visit.scheduledAt) return "Unscheduled"
  return format(new Date(visit.scheduledAt), "EEE, MMM d")
}

const EMPTY_MESSAGES: Record<string, { title: string; description: string }> = {
  scheduled: {
    title: "No visits scheduled yet.",
    description: "Schedule a visit to see it on your route.",
  },
  all: {
    title: "No visits found.",
    description: "Try adjusting your filter criteria.",
  },
  completed: {
    title: "No completed visits.",
    description: "Completed visits will appear here.",
  },
  cancelled: {
    title: "No cancelled visits.",
    description: "Cancelled visits will appear here.",
  },
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; poolId?: string; fromDate?: string; toDate?: string; page?: string }>
}) {
  const user = await requireTech()
  if (!user.companyId) {
    redirect("/admin")
  }

  const sp = await searchParams
  const currentPage = Math.max(1, Number(sp.page) || 1)
  const filters: ScheduleFilters = {
    status: (sp.tab as ScheduleFilters["status"]) || "scheduled",
    poolId: sp.poolId || undefined,
    fromDate: sp.fromDate || undefined,
    toDate: sp.toDate || undefined,
    // Techs only see their own + unassigned visits; owners/admins see all.
    techId: user.role === "TECH" ? user.id : undefined,
  }

  const spForLinks = new URLSearchParams()
  if (sp.tab && sp.tab !== "scheduled") spForLinks.set("tab", sp.tab)
  if (sp.poolId) spForLinks.set("poolId", sp.poolId)
  if (sp.fromDate) spForLinks.set("fromDate", sp.fromDate)
  if (sp.toDate) spForLinks.set("toDate", sp.toDate)

  const [{ visits, total }, pools, techs] = await Promise.all([
    getScheduleData(user.companyId, currentPage, filters),
    getPoolsByCompany(user.companyId),
    getCompanyTechs(user.companyId),
  ])

  const totalPages = Math.ceil(total / SCHEDULE_PAGE_SIZE)
  const groups = groupVisits(visits)
  const tab = filters.status || "scheduled"
  const empty = EMPTY_MESSAGES[tab] ?? EMPTY_MESSAGES.scheduled

  return (
    <Shell title="Schedule">
      <div className="space-y-3">
        <div className="flex items-center justify-end">
          <ScheduleVisitForm
            pools={pools.map((pool) => ({ id: pool.id, name: pool.name }))}
            techs={techs}
            userRole={user.role}
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <ScheduleFiltersComponent
            pools={pools.map((p) => ({ id: p.id, name: p.name }))}
          />
        </div>

        <hr className="border-border" />

        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CalendarClock className="size-8" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">
              {total === 0 ? empty.title : "No visits on this page."}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {total === 0
                ? empty.description
                : "Try adjusting your filter criteria."}
            </p>
          </div>
        ) : (
          <>
            {groups.map((group) => (
              <section key={group.key}>
                <h2 className="mb-3 text-sm font-medium text-foreground">
                  {group.title}
                </h2>
                <div className="space-y-3">
                  {group.visits.map((visit) => (
                    <ScheduleVisitCard
                      key={visit.id}
                      visit={visit}
                      timeLabel={timeLabelFor(visit)}
                    />
                  ))}
                </div>
              </section>
            ))}

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
                      href={`/schedule?${buildQueryString(spForLinks, { page: String(currentPage - 1) })}`}
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
                          href={`/schedule?${buildQueryString(spForLinks, { page: String(item) })}`}
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
                      href={`/schedule?${buildQueryString(spForLinks, { page: String(currentPage + 1) })}`}
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
              Page {currentPage} of {totalPages} ({total} visit{total !== 1 ? "s" : ""})
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
