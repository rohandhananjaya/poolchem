"use server"

import { revalidatePath } from "next/cache"

import { requireAuth } from "@/lib/auth"
import { createFeedback } from "@/lib/db/feedback"
import { formText } from "@/lib/utils"
import type { FeedbackType } from "@/generated/prisma/client"

/** Result returned to `useActionState` on the client. */
export interface FormState {
  ok: boolean
  error?: string
}

const FEEDBACK_TYPES: FeedbackType[] = ["BUG_REPORT", "FEATURE_REQUEST", "ISSUE"]
const MAX_TITLE_LENGTH = 120
const MAX_DESCRIPTION_LENGTH = 4000

/** Submits a support request (bug report, feature request, or general issue). */
export async function submitFeedbackAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAuth()

  const type = formData.get("type") as string
  const title = formText(formData, "title")
  const description = formText(formData, "description")

  if (!FEEDBACK_TYPES.includes(type as FeedbackType)) {
    return { ok: false, error: "Please choose a report type." }
  }
  if (title === "") {
    return { ok: false, error: "A short title is required." }
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return {
      ok: false,
      error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`,
    }
  }
  if (description === "") {
    return { ok: false, error: "Please describe what you ran into." }
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      error: `Details must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`,
    }
  }

  try {
    await createFeedback(
      { type: type as FeedbackType, title, description },
      user.id,
      user.companyId ?? null,
    )
    revalidatePath("/feedback")
    return { ok: true }
  } catch {
    return {
      ok: false,
      error: "Could not submit your report. Please try again.",
    }
  }
}
