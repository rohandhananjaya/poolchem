import { Waves } from "lucide-react"

/**
 * Shown when today's route has no visits. Reassuring, not alarming — an empty
 * route is a good thing.
 */
export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Waves className="size-8" />
      </div>
      <p className="mt-4 text-sm font-medium text-foreground">
        No visits scheduled for today.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Enjoy your day! 🏊
      </p>
    </div>
  )
}
