import { Shell } from "@/components/ui/shell"
import {
  StatsSkeleton,
  TableSkeleton,
} from "@/components/ui/loading-skeleton"

export default function ReportsLoading() {
  return (
    <Shell title="Reports">
      <StatsSkeleton />
      <div className="mt-8">
        <TableSkeleton rows={6} cols={4} />
      </div>
    </Shell>
  )
}
