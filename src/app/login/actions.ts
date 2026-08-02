"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { formText } from "@/lib/utils"

export interface LoginFormState {
  ok: boolean
  error?: string
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
