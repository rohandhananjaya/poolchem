import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A generic card row — the standard `rounded-xl border border-border bg-card p-4`
 * wrapper used by feature cards throughout the app.
 *
 * - **`hover`** — adds `hover:bg-muted transition-colors` (same as `ReportRow`).
 * - **`actions`** — rendered in the trailing slot (e.g. a three-dot dropdown).
 */
export function CardRow({
  className,
  hover,
  actions,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  hover?: boolean
  actions?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border border-border bg-card p-4",
        hover && "transition-colors hover:bg-muted",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  )
}
