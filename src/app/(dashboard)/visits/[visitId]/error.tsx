"use client"

import { useEffect } from "react"
import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function VisitError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center px-4 py-24">
      <AlertCircle className="size-12 text-destructive" />
      <h2 className="mt-4 text-lg font-semibold text-foreground">
        Something went wrong
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {error.message || "Failed to load visit data."}
      </p>
      <Button
        variant="outline"
        size="lg"
        className="mt-6"
        onClick={() => reset()}
      >
        Try again
      </Button>
    </div>
  )
}
