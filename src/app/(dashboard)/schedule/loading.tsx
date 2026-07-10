import { Shell } from "@/components/ui/shell"
import { CardListSkeleton } from "@/components/ui/loading-skeleton"

export default function ScheduleLoading() {
  return (
    <Shell title="Schedule">
      <CardListSkeleton count={5} />
    </Shell>
  )
}
