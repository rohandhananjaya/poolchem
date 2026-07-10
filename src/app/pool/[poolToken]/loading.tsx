import { Skeleton } from "@/components/ui/loading-skeleton"

/** Mirrors the public homeowner dashboard (hero card, date tiles, timeline). */
export default function HomeownerLoading() {
  return (
    <main className="min-h-full bg-gradient-to-b from-sky-50 via-cyan-50/40 to-background dark:from-slate-950 dark:via-slate-950 dark:to-background">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
        {/* Company chip */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <Skeleton className="size-6 rounded-md" />
          <Skeleton className="h-4 w-40" />
        </div>

        {/* Hero card */}
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <Skeleton className="h-44 w-full rounded-none sm:h-56" />
          <div className="flex flex-col items-center gap-4 p-6 sm:p-8">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="size-44 rounded-full" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>

        {/* Date tiles */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <Skeleton className="size-9 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          ))}
        </div>

        {/* Recent activity */}
        <div className="mt-4 rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-4 w-32" />
          <div className="mt-3 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
