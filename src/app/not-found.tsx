import Link from "next/link"
import { Droplets, Home, Waves } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * App-wide 404. Rendered for `notFound()` calls without a closer `not-found.tsx`
 * and for any unmatched URL. Pool-themed to stay on-brand.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      {/* Pool-themed illustration: a "404" floating on water. */}
      <div className="relative flex size-32 items-center justify-center overflow-hidden rounded-full bg-gradient-to-b from-sky-100 to-cyan-200 dark:from-slate-800 dark:to-slate-900">
        <span className="text-3xl font-bold tracking-tight text-teal-700 dark:text-teal-300">
          404
        </span>
        <Waves className="absolute bottom-3 left-1/2 size-16 -translate-x-1/2 text-cyan-500/40 dark:text-cyan-400/30" />
      </div>

      <h1 className="mt-6 text-xl font-semibold tracking-tight text-foreground">
        This page took a dip
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        We couldn&apos;t find the page you were looking for. It may have been
        moved, or the link might be broken.
      </p>

      <div className="mt-6">
        <Button asChild>
          <Link href="/dashboard">
            <Home />
            Back to dashboard
          </Link>
        </Button>
      </div>

      <p className="mt-8 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Droplets className="size-3.5 text-teal-500" />
        PoolChem
      </p>
    </div>
  )
}
