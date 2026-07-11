import { Shell } from "@/components/ui/shell"
import { Skeleton, CardListSkeleton } from "@/components/ui/loading-skeleton"

export default function PoolsLoading() {
  return (
    <Shell title="Pools">
      <div className="space-y-6">
        <div className="flex items-center justify-end">
          <Skeleton className="h-7 w-28 rounded-lg" />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-8 w-48 rounded-lg" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-8 w-32 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-16 rounded-lg" />
            <Skeleton className="h-7 w-16 rounded-lg" />
          </div>
        </div>

        <hr className="border-border" />

        <CardListSkeleton count={6} />
      </div>
    </Shell>
  )
}
