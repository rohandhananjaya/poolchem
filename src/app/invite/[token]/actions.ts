"use server"

import { prisma } from "@/lib/prisma"
import { createAdminClient } from "@/lib/supabase/admin"
import { createUser } from "@/lib/db/users"
import { getValidInvitation, acceptInvitation } from "@/lib/db/invitations"
import { formText } from "@/lib/utils"

export interface AcceptFormState {
  ok: boolean
  error?: string
}

export async function acceptInvitationAction(
  _prev: AcceptFormState,
  formData: FormData,
): Promise<AcceptFormState> {
  const token = formText(formData, "token")
  const password = formText(formData, "password")

  if (!token) return { ok: false, error: "Invalid invitation link." }
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." }
  }

  const invitation = await getValidInvitation(token)
  if (!invitation) {
    return { ok: false, error: "This invitation is invalid or has expired." }
  }

  const existing = await prisma.user.findUnique({
    where: { email: invitation.email },
  })
  if (existing) {
    return { ok: false, error: "A user with this email already exists." }
  }

  try {
    const admin = createAdminClient()
    if (admin) {
      const { error: authError } = await admin.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true,
      })

      if (authError) {
        if (/already been registered|already exists/i.test(authError.message)) {
          return { ok: false, error: "A user with this email already exists." }
        }
        return { ok: false, error: `Failed to create account: ${authError.message}` }
      }
    }

    await createUser({
      name: invitation.name,
      email: invitation.email,
      role: invitation.role,
      companyId: invitation.companyId,
    })

    await acceptInvitation(token)

    return { ok: true }
  } catch {
    return { ok: false, error: "Could not accept invitation. Please try again." }
  }
}
