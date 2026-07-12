import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { ReactNode } from "react"

interface StatTileProps {
  label: string
  value: string | number
  icon?: ReactNode
  href?: string
  hint?: string
  size?: "sm" | "md"
}

export function StatTile({
  label,
  value,
  icon,
  href,
  hint,
  size = "md",
}: StatTileProps) {
  const valueSize =
    size === "sm"
      ? "text-lg font-semibold"
      : "text-2xl font-bold"

  const content = (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon ? (
            <span className="shrink-0">{icon}</span>
          ) : null}
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
        </div>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span
            className={`font-mono ${valueSize} tabular-nums text-card-foreground`}
          >
            {value}
          </span>
          {hint ? (
            <span className="text-base font-normal text-muted-foreground">
              {hint}
            </span>
          ) : null}
        </p>
      </div>
      {href ? (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      ) : null}
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}
