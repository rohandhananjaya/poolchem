"use server"

import { revalidatePath } from "next/cache"

import { requireAuth } from "@/lib/auth"
import { updateCompany } from "@/lib/db/company"
import { createPool } from "@/lib/db/pools"
import { formOptionalText, formText } from "@/lib/utils"

export interface OnboardingFormState {
  ok: boolean
  error?: string
}

export async function updateCompanyDetailsAction(
  _prev: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const user = await requireAuth()
  if (!user.companyId) return { ok: false, error: "No company found." }

  const phone = formOptionalText(formData, "phone")
  const address = formOptionalText(formData, "address")

  try {
    await updateCompany(user.companyId, {
      phone: phone ?? null,
      address: address ?? null,
    })
    revalidatePath("/onboarding")
    return { ok: true }
  } catch {
    return { ok: false, error: "Could not save company details." }
  }
}

export async function createFirstPoolAction(
  _prev: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const user = await requireAuth()
  if (!user.companyId) return { ok: false, error: "No company found." }

  const name = formText(formData, "name")
  const volume = Number.parseInt(formText(formData, "volume"), 10)
  const address = formOptionalText(formData, "address")

  if (name === "") return { ok: false, error: "Pool name is required." }
  if (Number.isNaN(volume) || volume < 1) {
    return { ok: false, error: "Volume must be a positive number." }
  }

  try {
    await createPool({ name, volume, address }, user.companyId)
    revalidatePath("/onboarding")
    return { ok: true }
  } catch {
    return { ok: false, error: "Could not create pool." }
  }
}
