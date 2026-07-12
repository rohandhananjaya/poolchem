import { Waves } from "lucide-react"

import { EmptyState as EmptyStateBase } from "@/components/ui/empty-state"

/**
 * Shown when today's route has no visits. Reassuring, not alarming — an empty
 * route is a good thing.
 */
export function EmptyState() {
  return (
    <EmptyStateBase
      icon={<Waves className="size-8" />}
      title="No visits scheduled for today."
      description="Enjoy your day! 🏊"
    />
  )
}
