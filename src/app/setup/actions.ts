"use server"

import { prisma } from "@/lib/prisma"
import { createAdminClient } from "@/lib/supabase/admin"
import { createUser, hasSuperAdmin } from "@/lib/db/users"
import { formText } from "@/lib/utils"
import { notifyWelcome } from "@/lib/email/notify"

export interface SetupFormState {
  ok: boolean
  error?: string
}

/**
 * Creates the platform's first SUPER_ADMIN. Only runs while none exists —
 * re-checked here so the wizard can't be replayed to mint extra admins after
 * setup has already completed.
 */
export async function setupAction(
  _prev: SetupFormState,
  formData: FormData,
): Promise<SetupFormState> {
  if (await hasSuperAdmin()) {
    return { ok: false, error: "Setup has already been completed. Please sign in instead." }
  }

  const name = formText(formData, "name")
  const email = formText(formData, "email")
  const password = formText(formData, "password")

  if (name === "") return { ok: false, error: "Your name is required." }
  if (email === "") return { ok: false, error: "Email is required." }
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." }
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return { ok: false, error: "An account with this email already exists." }
  }

  try {
    const admin = createAdminClient()
    let supabaseId: string | null = null
    if (admin) {
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (authError) {
        if (/already been registered|already exists/i.test(authError.message)) {
          return { ok: false, error: "An account with this email already exists." }
        }
        return { ok: false, error: `Failed to create account: ${authError.message}` }
      }
      supabaseId = authData.user.id
    }

    await createUser({
      name,
      email,
      role: "SUPER_ADMIN",
      companyId: null,
      supabaseId,
    })

    await notifyWelcome({ to: email, name })

    return { ok: true }
  } catch {
    return { ok: false, error: "Could not create the admin account. Please try again." }
  }
}
