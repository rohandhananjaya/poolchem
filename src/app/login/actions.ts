"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyPasswordReset } from "@/lib/email/notify"
import { formText } from "@/lib/utils"
import { verifyTurnstileToken, TURNSTILE_ERROR_MESSAGE } from "@/lib/turnstile"

export interface LoginFormState {
  ok: boolean
  error?: string
  sent?: boolean
  unconfirmed?: boolean
  email?: string
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

  const turnstileToken = formText(formData, "cf-turnstile-response")
  if (!(await verifyTurnstileToken(turnstileToken))) {
    return { ok: false, error: TURNSTILE_ERROR_MESSAGE }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { ok: false, error: error.message }
  }

  if (!data.user.email_confirmed_at) {
    await supabase.auth.signOut()
    return {
      ok: false,
      error: "Please confirm your email before signing in. Check your inbox for the confirmation link.",
      unconfirmed: true,
      email,
    }
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

  const turnstileToken = formText(formData, "cf-turnstile-response")
  if (!(await verifyTurnstileToken(turnstileToken))) {
    return { ok: false, error: TURNSTILE_ERROR_MESSAGE }
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

  // Build our own link from the hashed token rather than using
  // `action_link` (a direct link to Supabase's hosted verify endpoint) so the
  // emailed URL never exposes the Supabase project host.
  const tokenHash = data?.properties?.hashed_token
  if (tokenHash) {
    const resetUrl = `${origin}/auth/update-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`
    await notifyPasswordReset({ to: email, resetUrl })
  }

  return { ok: true, sent: true }
}

/**
 * Resends the signup-confirmation email for an account stuck unconfirmed.
 * Uses Supabase's own `auth.resend()` (not the admin client) since it needs no
 * password and can't accidentally mutate the account — the tradeoff is that
 * this one email is delivered via Supabase's own template/SMTP rather than the
 * app's Resend-branded one. Always returns success (no user enumeration).
 */
export async function resendConfirmationAction(
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = formText(formData, "email")
  if (email === "") {
    return { ok: false, error: "Email is required." }
  }

  const turnstileToken = formText(formData, "cf-turnstile-response")
  if (!(await verifyTurnstileToken(turnstileToken))) {
    return { ok: false, error: TURNSTILE_ERROR_MESSAGE }
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000"
  const supabase = await createClient()
  await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent("/onboarding")}` },
  })

  return { ok: true, sent: true }
}
