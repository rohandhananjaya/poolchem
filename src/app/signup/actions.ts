"use server"

import { prisma } from "@/lib/prisma"
import { createAdminClient } from "@/lib/supabase/admin"
import { createCompany } from "@/lib/db/company"
import { createUser } from "@/lib/db/users"
import { formText } from "@/lib/utils"
import { startTrial } from "@/lib/db/packages"

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
  const packageSlug = formText(formData, "package") || "starter"

  if (companyName === "") return { ok: false, error: "Company name is required." }
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

    const company = await createCompany({ name: companyName, email })

    await createUser({
      name,
      email,
      role: "OWNER",
      companyId: company.id,
      supabaseId,
    })

    await startTrial(company.id, packageSlug)

    return { ok: true }
  } catch {
    return { ok: false, error: "Could not create your account. Please try again." }
  }
}
