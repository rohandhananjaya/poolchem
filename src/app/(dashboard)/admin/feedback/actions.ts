"use server"

import { revalidatePath } from "next/cache"

import { requireSuperAdmin } from "@/lib/auth"
import { updateFeedbackStatus } from "@/lib/db/feedback"
import type { FeedbackStatus } from "@/generated/prisma/client"

const FEEDBACK_STATUSES: FeedbackStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
]

/** Updates a submission's triage status (super-admin only). */
export async function updateFeedbackStatusAction(
  feedbackId: string,
  status: FeedbackStatus,
): Promise<void> {
  await requireSuperAdmin()

  if (!FEEDBACK_STATUSES.includes(status)) {
    throw new Error("Invalid status.")
  }

  await updateFeedbackStatus(feedbackId, status)
  revalidatePath("/admin/feedback")
}
