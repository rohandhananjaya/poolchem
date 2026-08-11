import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, FileText, FlaskConical } from "lucide-react"

import { requireActivePackage } from "@/lib/auth"
import { getVisitById, getLastVisitReadings } from "@/lib/db/visits"
import { getCompanyPackage } from "@/lib/db/packages"
import { getHealthScoringLevel } from "@/lib/package-features"
import type { OfflineServiceVisitStatus } from "@/lib/offline/types"
import type { CachedVisit } from "@/lib/offline/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { VisitsCacheMirror } from "@/components/offline/visits-cache-mirror"
import { VisitForm } from "./visit-form"
import { StatusDropdown } from "./status-dropdown"

export default async function VisitPage({
  params,
  searchParams,
}: {
  params: Promise<{ visitId: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { visitId } = await params
  const user = await requireActivePackage()
  if (!user.companyId) return null
  const companyId = user.companyId

  const visit = await getVisitById(visitId, user.companyId)
  if (!visit) notFound()

  const lastReadings = await getLastVisitReadings(visit.poolId, companyId)
  // Multi-body visits: fetch each body's own previous-reading hint (pool-scoped)
  // so every tab shows its pool's last readings, not just body 0's.
  const lastReadingsByJoinId =
    visit.serviceVisitPools.length > 0
      ? Object.fromEntries(
          await Promise.all(
            visit.serviceVisitPools.map(async (join) => [
              join.id,
              await getLastVisitReadings(join.pool.id, companyId),
            ]),
          ),
        )
      : {}
  const canUseLSI =
    getHealthScoringLevel(await getCompanyPackage(user.companyId)) ===
    "advanced+lsi"
  const completed = visit.status === "COMPLETED"
  const inProgress = visit.status === "IN_PROGRESS"
  const { from } = await searchParams

  const statusBadgeClass = completed
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
    : inProgress
      ? "bg-brand-50 text-brand-900 dark:bg-brand-900 dark:text-brand-200"
      : visit.status === "CANCELLED"
        ? "bg-muted text-muted-foreground"
        : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"

  const statusLabel = completed
    ? "Completed"
    : inProgress
      ? "In Progress"
      : visit.status === "CANCELLED"
        ? "Cancelled"
        : "Scheduled"

  const currentReadings = visit.waterReadings[0] ?? lastReadings
  const cachedVisit: CachedVisit = {
    visitId: visit.id,
    companyId: user.companyId,
    pool: {
      id: visit.pool.id,
      name: visit.pool.name,
      address: visit.pool.address,
      volume: visit.pool.volume,
      image: visit.pool.image,
    },
    status: visit.status as OfflineServiceVisitStatus,
    cancellationReason: visit.cancellationReason,
    scheduledAt: visit.scheduledAt ? visit.scheduledAt.toISOString() : null,
    lastReadings: currentReadings
      ? {
          ph: currentReadings.ph,
          freeChlorine: currentReadings.freeChlorine,
          totalAlkalinity: currentReadings.totalAlkalinity,
          calciumHardness: currentReadings.calciumHardness,
          cyanuricAcid: currentReadings.cyanuricAcid,
          temperature: currentReadings.temperature,
        }
      : null,
    chemicals: visit.chemicalsAdded.map((c) => ({
      name: c.name,
      amount: c.amount,
      unit: c.unit,
    })),
    notes: visit.notes,
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <VisitsCacheMirror visit={cachedVisit} />
      <Link
        href={from ?? "/dashboard"}
        className="mb-4 inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted"
        aria-label={from ? "Back" : "Back to dashboard"}
      >
        <ArrowLeft className="size-4" />
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
              {visit.pool.name}
            </h1>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                statusBadgeClass,
              )}
            >
              {statusLabel}
            </span>
            {!completed && visit.status !== "CANCELLED" && (
              <StatusDropdown
                visitId={visit.id}
                currentStatus={visit.status as "DRAFT" | "IN_PROGRESS" | "CANCELLED"}
                currentUserId={user.id}
                techId={visit.techId}
              />
            )}
            {visit.status === "CANCELLED" && visit.cancellationReason && (
              <p className="mt-1 text-sm text-muted-foreground">
                Reason: {visit.cancellationReason}
              </p>
            )}
          </div>

          {visit.pool.address && (
            <p className="mt-1 text-sm text-muted-foreground">
              {visit.pool.address}
            </p>
          )}

          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            <FlaskConical className="size-3" />
            {visit.pool.volume.toLocaleString()} gal
          </span>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-3">
          {visit.pool.image && (
            <Image
              src={visit.pool.image}
              alt={visit.pool.name}
              width={56}
              height={56}
              className="size-14 rounded-xl object-cover"
            />
          )}
          {completed && (
            <Button asChild size="lg" variant="outline">
              <Link href={`/visits/${visitId}/report`}>
                <FileText />
                View Report
              </Link>
            </Button>
          )}
        </div>
      </div>

      <VisitForm
        key={visit.id}
        companyId={user.companyId}
        visit={JSON.parse(JSON.stringify(visit))}
        lastReadings={lastReadings ? JSON.parse(JSON.stringify(lastReadings)) : null}
        lastReadingsByJoinId={
          Object.keys(lastReadingsByJoinId).length > 0
            ? JSON.parse(JSON.stringify(lastReadingsByJoinId))
            : undefined
        }
        currentUser={{ id: user.id, name: user.name }}
        techId={visit.techId}
        canUseLSI={canUseLSI}
      />
    </div>
  )
}
