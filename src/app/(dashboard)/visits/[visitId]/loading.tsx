export default function VisitLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-4 size-8 animate-pulse rounded-lg bg-muted" />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="size-14 shrink-0 animate-pulse rounded-xl bg-muted" />
      </div>

      <div className="mt-6 space-y-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                <div className="h-12 animate-pulse rounded-lg bg-muted" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-around">
            <div className="size-44 animate-pulse rounded-full bg-muted" />
            <div className="h-16 w-full animate-pulse rounded-lg bg-muted" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  )
}
