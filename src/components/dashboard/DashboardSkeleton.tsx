/**
 * Pulsing placeholder that mirrors the dashboard layout (header, stats row, and
 * a few visit cards) while today's data loads.
 */
export function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-56 rounded-md bg-muted" />
          <div className="h-4 w-36 rounded-md bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="size-9 rounded-lg bg-muted" />
          <div className="size-9 rounded-lg bg-muted" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-[76px] rounded-xl border border-border bg-card p-4"
          >
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="mt-3 h-6 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Visit cards */}
      <div className="mt-8 space-y-3">
        <div className="h-5 w-32 rounded-md bg-muted" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="h-3 w-56 rounded bg-muted" />
              <div className="h-3 w-24 rounded bg-muted" />
            </div>
            <div className="h-9 w-24 rounded-lg bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
