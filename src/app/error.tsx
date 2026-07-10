"use client" // Error boundaries must be Client Components

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Home, RefreshCw, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * App-level error boundary. Catches unhandled errors thrown anywhere below the
 * root layout that isn't covered by a nested `error.tsx`, and shows a friendly
 * recovery page with retry / go-back / go-home actions.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    // Log the error to an error reporting service.
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-8" />
      </div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">
        Something went wrong
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        An unexpected error occurred. You can try again, or head back to safer
        waters.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-muted-foreground/70">
          Reference: {error.digest}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => unstable_retry()}>
          <RefreshCw />
          Try again
        </Button>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft />
          Go back
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">
            <Home />
            Go home
          </Link>
        </Button>
      </div>
    </div>
  )
}
