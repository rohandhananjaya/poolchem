import { Skeleton, TableSkeleton } from "@/components/ui/loading-skeleton"

/** Mirrors the service-report sheet (toolbar, header, score, test table). */
export default function ReportLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6 md:py-8">
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <Skeleton className="size-8 rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      {/* Report sheet */}
      <div className="space-y-6 rounded-2xl border border-border bg-card p-6">
        {/* Company header */}
        <div className="flex items-center gap-3 border-b border-border pb-5">
          <Skeleton className="size-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-3 w-72" />
        </div>

        {/* Score card */}
        <div className="flex flex-col items-center gap-5 rounded-xl bg-muted/40 p-5 sm:flex-row sm:justify-around">
          <Skeleton className="size-44 rounded-full" />
          <div className="w-full max-w-xs space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>

        {/* Test table */}
        <TableSkeleton rows={6} cols={4} />
      </div>
    </div>
  )
}
