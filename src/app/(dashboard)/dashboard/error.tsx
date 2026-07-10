"use client" // Error boundaries must be Client Components

import { useEffect } from "react"

import { Shell } from "@/components/ui/shell"
import { ErrorState } from "@/components/ui/error-state"

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
      <ErrorState
        title="Could not load your dashboard"
        description="Something went wrong while loading today's route. Please try again."
        onRetry={() => unstable_retry()}
      />
    </Shell>
  )
}
