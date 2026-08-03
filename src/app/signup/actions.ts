"use server"

import { prisma } from "@/lib/prisma"
import { createAdminClient } from "@/lib/supabase/admin"
import { createCompany } from "@/lib/db/company"
import { createUser } from "@/lib/db/users"
import { formText } from "@/lib/utils"
import { startTrial } from "@/lib/db/packages"
import { notifyConfirmSignup } from "@/lib/email/notify"
import { verifyTurnstileToken, TURNSTILE_ERROR_MESSAGE } from "@/lib/turnstile"

function getOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000"
}

export interface SignupFormState {
  ok: boolean
  error?: string
}

export async function signupAction(
  _prev: SignupFormState,
  formData: FormData,
): Promise<SignupFormState> {
  const companyName = formText(formData, "companyName")
  const name = formText(formData, "name")
  const email = formText(formData, "email")
  const password = formText(formData, "password")

  if (companyName === "") return { ok: false, error: "Company name is required." }
  if (name === "") return { ok: false, error: "Your name is required." }
  if (email === "") return { ok: false, error: "Email is required." }
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." }
  }

  const turnstileToken = formText(formData, "cf-turnstile-response")
  if (!(await verifyTurnstileToken(turnstileToken))) {
    return { ok: false, error: TURNSTILE_ERROR_MESSAGE }
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return { ok: false, error: "An account with this email already exists." }
  }

  try {
    const admin = createAdminClient()
    let supabaseId: string | null = null
    let confirmUrl: string | null = null
    if (admin) {
      const origin = getOrigin()
      const { data: authData, error: authError } = await admin.auth.admin.generateLink({
        type: "signup",
        email,
        password,
        options: { redirectTo: `${origin}/auth/confirm` },
      })

      if (authError) {
        if (/already been registered|already exists/i.test(authError.message)) {
          return { ok: false, error: "An account with this email already exists." }
        }
        return { ok: false, error: `Failed to create account: ${authError.message}` }
      }
      supabaseId = authData.user.id
      const tokenHash = authData.properties?.hashed_token
      if (tokenHash) {
        confirmUrl = `${origin}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=signup&next=${encodeURIComponent("/onboarding")}`
      }
    }

    const company = await createCompany({ name: companyName, email })

    await createUser({
      name,
      email,
      role: "OWNER",
      companyId: company.id,
      supabaseId,
    })

    await startTrial(company.id)

    if (confirmUrl) {
      await notifyConfirmSignup({ to: email, name, confirmUrl })
    }

    return { ok: true }
  } catch {
    return { ok: false, error: "Could not create your account. Please try again." }
  }
}
