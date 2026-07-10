import * as React from "react"
import { RefreshCw, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface ErrorStateProps extends React.ComponentProps<"div"> {
  /** Short headline, e.g. "Could not load visits". */
  title?: string
  /** Supporting sentence explaining what happened / what to do next. */
  description?: string
  /** Icon shown in the badge. Defaults to a warning triangle. */
  icon?: React.ReactNode
  /** When provided, renders a retry button wired to this handler. */
  onRetry?: () => void
  /** Label for the retry button. */
  retryLabel?: string
}

/**
 * Generic, centered error panel: an icon badge, a title, a description, and an
 * optional retry button. Used by route `error.tsx` boundaries and anywhere a
 * section fails to load. Purely presentational — pass `onRetry` to make it
 * interactive.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "An unexpected error occurred. Please try again.",
  icon,
  onRetry,
  retryLabel = "Try again",
  className,
  children,
  ...props
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center",
        className,
      )}
      {...props}
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        {icon ?? <TriangleAlert className="size-8" />}
      </div>
      <p className="mt-4 text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {onRetry ? (
        <Button className="mt-5" onClick={onRetry}>
          <RefreshCw />
          {retryLabel}
        </Button>
      ) : null}
      {children}
    </div>
  )
}
