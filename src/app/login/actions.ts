"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyPasswordReset } from "@/lib/email/notify"
import { formText } from "@/lib/utils"

export interface LoginFormState {
  ok: boolean
  error?: string
  sent?: boolean
}

export async function loginAction(
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = formText(formData, "email")
  const password = formText(formData, "password")
  const code = formText(formData, "code")

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/", "layout")
  // A `code` means the user arrived via a scanned pool QR — send them straight
  // into the scan flow so the visit can start.
  redirect(code ? `/scan?code=${encodeURIComponent(code)}` : "/dashboard")
}

/**
 * Requests a password-reset link for an existing account. Uses the admin
 * client to mint a recovery link, which we then deliver via our own Resend
 * template. Always returns success for unknown emails (no user enumeration),
 * and never blocks the UI on email-delivery problems.
 */
export async function requestPasswordResetAction(
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = formText(formData, "email")
  if (email === "") {
    return { ok: false, error: "Email is required." }
  }

  const admin = createAdminClient()
  if (!admin) {
    return { ok: false, error: "Password reset is not configured yet. Please contact support." }
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000"
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${origin}/auth/update-password` },
  })

  if (error) {
    // Don't reveal whether the email has an account.
    if (/not found/i.test(error.message)) return { ok: true, sent: true }
    return { ok: false, error: "We couldn't send a reset link. Please try again." }
  }

  const resetUrl = data?.properties?.action_link
  if (resetUrl) {
    await notifyPasswordReset({ to: email, resetUrl })
  }

  return { ok: true, sent: true }
}
