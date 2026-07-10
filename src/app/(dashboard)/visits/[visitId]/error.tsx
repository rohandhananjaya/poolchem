"use client"

import { useEffect } from "react"

import { ErrorState } from "@/components/ui/error-state"

export default function VisitError({
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
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <ErrorState
        title="Could not load this visit"
        description={error.message || "Failed to load visit data. Please try again."}
        onRetry={() => unstable_retry()}
      />
    </div>
  )
}
