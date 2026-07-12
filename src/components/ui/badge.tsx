import { cn } from "@/lib/utils"

/* ── Health Score Badge ─────────────────────────────────────────── */

/** Maps a 0–100 water-health score to a traffic-light badge tone. */
export function healthBadgeClasses(score: number): string {
  if (score >= 75) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
  }
  if (score >= 50) {
    return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
  }
  return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
}

export function HealthBadge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        No reading
      </span>
    )
  }

  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
        healthBadgeClasses(score),
      )}
    >
      {score}
    </span>
  )
}

/* ── Active/Inactive Badge ──────────────────────────────────────── */

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
      Active
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      Inactive
    </span>
  )
}
