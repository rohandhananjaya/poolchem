"use server"

import { revalidatePath } from "next/cache"

import { getCompanyId } from "@/lib/auth"
import { simulatePayment, startTrial, getCompanyPackage } from "@/lib/db/packages"
import { getPackageBySlug } from "@/lib/db/packages"
import { getActiveProviders } from "@/lib/payment"
import { getPaymentSettings } from "@/lib/db/payment-settings"
import type { CompanyPackageInfo } from "@/lib/package-features"
import type { PaymentProviderName } from "@/lib/payment/types"

export interface PaymentActionState {
  ok: boolean
  error?: string
  companyPackage?: CompanyPackageInfo
  redirectUrl?: string
}

export async function createPaymentAction(
  _prev: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return { ok: false, error: "No company found." }

    const packageSlug = formData.get("package") as string
    const providerName = formData.get("provider") as PaymentProviderName | undefined

    if (!packageSlug) return { ok: false, error: "No package selected." }

    const pkg = await getPackageBySlug(packageSlug)
    if (!pkg) return { ok: false, error: "Package not found." }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

    const providers = await getActiveProviders()
    const paymentSettings = await getPaymentSettings()
    const devMode = paymentSettings.paymentDevMode

    if (providers.length === 0) {
      return { ok: false, error: "No payment method is enabled. Please contact support." }
    }

    if (providers.length === 1 && !providerName) {
      const activeProvider = providers[0]
      const result = await activeProvider.createCheckout({
        companyId,
        packageSlug,
        price: pkg.price,
        name: pkg.name,
        successUrl: `${baseUrl}/account/package?success=1`,
        cancelUrl: `${baseUrl}/account/package`,
      }, devMode)
      return {
        ok: true,
        companyPackage: undefined,
        redirectUrl: result.url,
      }
    }

    if (providers.length > 1 && !providerName) {
      return {
        ok: false,
        error: "PROVIDER_CHOICE_REQUIRED",
      }
    }

    const chosenProvider = providers.find((p) => p.name === providerName)
    if (!chosenProvider) {
      return { ok: false, error: `Payment provider "${providerName}" is not available.` }
    }

    const result = await chosenProvider.createCheckout({
      companyId,
      packageSlug,
      price: pkg.price,
      name: pkg.name,
      successUrl: `${baseUrl}/account/package?success=1`,
      cancelUrl: `${baseUrl}/account/package`,
    }, devMode)

    return {
      ok: true,
      redirectUrl: result.url,
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Payment failed." }
  }
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
  _formData: FormData,
): Promise<PaymentActionState> {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return { ok: false, error: "No company found." }

    const result = await startTrial(companyId)
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

export async function getPaymentProvidersAction(): Promise<{
  stripeEnabled: boolean
  paypalEnabled: boolean
}> {
  const { getPaymentSettings } = await import("@/lib/db/payment-settings")
  return getPaymentSettings()
}
