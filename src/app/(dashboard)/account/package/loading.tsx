import { Shell } from "@/components/ui/shell"
import { CardSkeleton } from "@/components/ui/loading-skeleton"

export default function AccountPackageLoading() {
  return (
    <Shell title="Your Plan">
      <div className="space-y-8">
        <CardSkeleton />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </Shell>
  )
}
