"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import type { FeedbackStatus } from "@/generated/prisma/client"
import { FEEDBACK_STATUS_LABELS } from "@/components/feedback/feedback-badges"
import { updateFeedbackStatusAction } from "@/app/(dashboard)/admin/feedback/actions"

const STATUS_OPTIONS: FeedbackStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
]

export function FeedbackStatusSelect({
  feedbackId,
  currentStatus,
}: {
  feedbackId: string
  currentStatus: FeedbackStatus
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const status = event.target.value as FeedbackStatus
    if (status === currentStatus) return
    startTransition(async () => {
      try {
        await updateFeedbackStatusAction(feedbackId, status)
        toast.success("Status updated.")
      } catch {
        toast.error("Could not update status.")
      }
      router.refresh()
    })
  }

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      disabled={pending}
      aria-label="Update status"
      className="flex h-8 shrink-0 rounded-lg border border-input bg-background px-2 py-1 text-xs font-medium shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30"
    >
      {STATUS_OPTIONS.map((status) => (
        <option key={status} value={status}>
          {FEEDBACK_STATUS_LABELS[status]}
        </option>
      ))}
    </select>
  )
}
