import { redirect } from "next/navigation"
import { CalendarClock } from "lucide-react"
import { format, isPast, isThisWeek, isToday, isTomorrow } from "date-fns"

import { requireTech } from "@/lib/auth"
import { getScheduleData, type ScheduledVisit } from "@/lib/db/schedule"
import { getPoolsByCompany } from "@/lib/db/pools"
import { getCompanyTechs } from "@/lib/db/users"
import { Shell } from "@/components/ui/shell"
import { ScheduleVisitForm } from "@/components/schedule/ScheduleVisitForm"
import { ScheduleVisitCard } from "@/components/schedule/ScheduleVisitCard"

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

/** Date label for a visit card. We only capture a day, so no time is shown. */
function timeLabelFor(visit: ScheduledVisit): string {
  if (!visit.scheduledAt) return "Unscheduled"
  return format(new Date(visit.scheduledAt), "EEE, MMM d")
}

export default async function SchedulePage() {
  const user = await requireTech()
  if (!user.companyId) {
    redirect("/admin")
  }

  const [visits, pools, techs] = await Promise.all([
    getScheduleData(user.companyId),
    getPoolsByCompany(user.companyId),
    getCompanyTechs(user.companyId),
  ])

  const groups = groupVisits(visits)

  return (
    <Shell title="Schedule">
      <div className="space-y-6">
        <ScheduleVisitForm
          pools={pools.map((pool) => ({ id: pool.id, name: pool.name }))}
          techs={techs}
          userRole={user.role}
        />

        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CalendarClock className="size-8" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">
              No visits scheduled yet.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Schedule a visit to see it on your route.
            </p>
          </div>
        ) : (
          groups.map((group) => (
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
          ))
        )}
      </div>
    </Shell>
  )
}
