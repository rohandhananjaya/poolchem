import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Base skeleton primitive: a pulsing, muted block. Compose it (or the presets
 * below) into route `loading.tsx` files and section-level fallbacks.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

/** A single card placeholder: title, two text lines, and a trailing action. */
function CardSkeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border border-border bg-card p-4",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-9 w-24 rounded-lg" />
    </div>
  )
}

/** A vertical stack of {@link CardSkeleton}s. */
function CardListSkeleton({
  count = 4,
  className,
  ...props
}: React.ComponentProps<"div"> & { count?: number }) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

/** A row of stat tiles (dashboard-style summary cards). */
function StatsSkeleton({
  count = 3,
  className,
  ...props
}: React.ComponentProps<"div"> & { count?: number }) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-3 sm:grid-cols-3", className)}
      {...props}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-[76px] rounded-xl border border-border bg-card p-4"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-6 w-16" />
        </div>
      ))}
    </div>
  )
}

/** A table placeholder with a header row and `rows` × `cols` body cells. */
function TableSkeleton({
  rows = 5,
  cols = 4,
  className,
  ...props
}: React.ComponentProps<"div"> & { rows?: number; cols?: number }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
      {...props}
    >
      <div
        className="grid gap-3 border-b border-border p-4"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full max-w-24" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid gap-3 p-4"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** A form placeholder: `fields` label+input pairs and a submit button. */
function FormSkeleton({
  fields = 4,
  className,
  ...props
}: React.ComponentProps<"div"> & { fields?: number }) {
  return (
    <div
      className={cn(
        "space-y-5 rounded-xl border border-border bg-card p-4",
        className,
      )}
      {...props}
    >
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-9 w-32 rounded-lg" />
    </div>
  )
}

export {
  Skeleton,
  CardSkeleton,
  CardListSkeleton,
  StatsSkeleton,
  TableSkeleton,
  FormSkeleton,
}
