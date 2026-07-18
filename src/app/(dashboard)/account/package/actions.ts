"use server"

import { revalidatePath } from "next/cache"

import { getCompanyId } from "@/lib/auth"
import { simulatePayment, startTrial, getCompanyPackage } from "@/lib/db/packages"
import type { CompanyPackageInfo } from "@/lib/package-features"

export interface PaymentActionState {
  ok: boolean
  error?: string
  companyPackage?: CompanyPackageInfo
}

export async function payNowAction(
  _prev: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return { ok: false, error: "No company found." }

    const packageSlug = formData.get("package") as string
    if (!packageSlug) return { ok: false, error: "No package selected." }

    const result = await simulatePayment(companyId, packageSlug)
    revalidatePath("/account/package")
    return { ok: true, companyPackage: result }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Payment failed." }
  }
}

export async function startTrialAction(
  _prev: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return { ok: false, error: "No company found." }

    const packageSlug = formData.get("package") as string
    if (!packageSlug) return { ok: false, error: "No package selected." }

    const result = await startTrial(companyId, packageSlug)
    revalidatePath("/account/package")
    return { ok: true, companyPackage: result }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to start trial." }
  }
}

export async function getCurrentPackageAction(): Promise<{
  ok: boolean
  data?: CompanyPackageInfo
  error?: string
}> {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return { ok: false, error: "No company found." }
    const data = await getCompanyPackage(companyId)
    return { ok: true, data: data ?? undefined }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to load." }
  }
}
