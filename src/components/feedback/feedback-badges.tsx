import type { FeedbackStatus, FeedbackType } from "@/generated/prisma/client"
import { cn } from "@/lib/utils"

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  BUG_REPORT: "Bug report",
  FEATURE_REQUEST: "Feature request",
  ISSUE: "General issue",
}

export const FEEDBACK_TYPE_STYLES: Record<FeedbackType, string> = {
  BUG_REPORT: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  FEATURE_REQUEST:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  ISSUE: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
}

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
}

export const FEEDBACK_STATUS_STYLES: Record<FeedbackStatus, string> = {
  OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  IN_PROGRESS:
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  RESOLVED:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  CLOSED: "bg-muted text-muted-foreground",
}

export function formatFeedbackDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function FeedbackTypeBadge({ type }: { type: FeedbackType }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
        FEEDBACK_TYPE_STYLES[type],
      )}
    >
      {FEEDBACK_TYPE_LABELS[type]}
    </span>
  )
}

export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
        FEEDBACK_STATUS_STYLES[status],
      )}
    >
      {FEEDBACK_STATUS_LABELS[status]}
    </span>
  )
}
