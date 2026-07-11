import { Shell } from "@/components/ui/shell"
import { CardListSkeleton } from "@/components/ui/loading-skeleton"

export default function PoolAnalysisLoading() {
  return (
    <Shell title="Pool Analysis">
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-48 rounded-md bg-muted" />
            <div className="h-4 w-64 rounded-md bg-muted" />
            <div className="flex gap-2">
              <div className="h-12 w-24 rounded-md bg-muted" />
              <div className="h-12 w-24 rounded-md bg-muted" />
              <div className="h-12 w-24 rounded-md bg-muted" />
            </div>
          </div>
        </div>
        <CardListSkeleton count={4} />
      </div>
    </Shell>
  )
}
