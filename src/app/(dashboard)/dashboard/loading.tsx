import { Shell } from "@/components/ui/shell"
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton"

export default function Loading() {
  return (
    <Shell>
      <DashboardSkeleton />
    </Shell>
  )
}
