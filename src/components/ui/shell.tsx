import * as React from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ShellProps extends React.ComponentProps<"div"> {
  /** Optional page title rendered in the header. */
  title?: string
  /** When set, renders a back button linking to this href in the header. */
  backHref?: string
  /** Accessible label for the back button. Defaults to "Go back". */
  backLabel?: string
}

/**
 * Reusable page shell providing consistent max-width and padding, with an
 * optional header showing a back button and title. Use inside dashboard pages.
 */
export function Shell({
  title,
  backHref,
  backLabel = "Go back",
  className,
  children,
  ...props
}: ShellProps) {
  const hasHeader = Boolean(title || backHref)

  return (
    <div
      className={cn("mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8", className)}
      {...props}
    >
      {hasHeader ? (
        <header className="mb-6 flex items-center gap-3">
          {backHref ? (
            <Link
              href={backHref}
              aria-label={backLabel}
              className={cn(
                "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors",
                "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              )}
            >
              <ArrowLeft className="size-4" />
            </Link>
          ) : null}
          {title ? (
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
          ) : null}
        </header>
      ) : null}
      {children}
    </div>
  )
}
