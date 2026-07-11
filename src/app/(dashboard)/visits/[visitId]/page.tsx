import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, FileText, FlaskConical } from "lucide-react"

import { requireTech } from "@/lib/auth"
import { getVisitById, getLastVisitReadings } from "@/lib/db/visits"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { VisitForm } from "./visit-form"

export default async function VisitPage({
  params,
  searchParams,
}: {
  params: Promise<{ visitId: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { visitId } = await params
  const user = await requireTech()
  if (!user.companyId) return null

  const visit = await getVisitById(visitId, user.companyId)
  if (!visit) notFound()

  const lastReadings = await getLastVisitReadings(visit.poolId)
  const completed = visit.status === "COMPLETED"
  const { from } = await searchParams

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
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
                completed
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
              )}
            >
              {completed ? "Completed" : "In Progress"}
            </span>
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
        visit={JSON.parse(JSON.stringify(visit))}
        lastReadings={lastReadings ? JSON.parse(JSON.stringify(lastReadings)) : null}
        currentUser={{ id: user.id, name: user.name }}
      />
    </div>
  )
}
