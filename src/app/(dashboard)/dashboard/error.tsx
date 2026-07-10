"use client" // Error boundaries must be Client Components

import { useEffect } from "react"
import { TriangleAlert } from "lucide-react"

import { Shell } from "@/components/ui/shell"
import { Button } from "@/components/ui/button"

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <Shell>
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert className="size-8" />
        </div>
        <p className="mt-4 text-sm font-medium text-foreground">
          Could not load visits
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Something went wrong while loading today&apos;s route.
        </p>
        <Button className="mt-5" onClick={() => unstable_retry()}>
          Try again
        </Button>
      </div>
    </Shell>
  )
}
