import { Shell } from "@/components/ui/shell"
import { FormSkeleton } from "@/components/ui/loading-skeleton"

export default function ProfileLoading() {
  return (
    <Shell title="Profile">
      <FormSkeleton fields={5} />
    </Shell>
  )
}
