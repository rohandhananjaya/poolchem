"use server"

import { revalidatePath } from "next/cache"

import { getCompanyId } from "@/lib/auth"
import { simulatePayment, startTrial, getCompanyPackage, handlePaymentSuccess } from "@/lib/db/packages"
import { getPackageBySlug } from "@/lib/db/packages"
import { getActiveProviders, getProvider } from "@/lib/payment"
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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000"

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

/**
 * Local dev has no way for PayPal's sandbox servers to deliver the
 * subscription-activated webhook to `https://localhost:3000` (no tunnel).
 * This confirms + activates a subscription synchronously from the return
 * page instead, using the same `handlePaymentSuccess` the webhook uses.
 */
const ACTIVATION_STATUS_RETRY_ATTEMPTS = 5
const ACTIVATION_STATUS_RETRY_DELAY_MS = 1000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function confirmPayPalSubscriptionAction(
  subscriptionId: string,
): Promise<PaymentActionState> {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return { ok: false, error: "No company found." }

    const provider = await getProvider("paypal")
    if (!provider.getSubscriptionStatus) {
      return { ok: false, error: "Subscription status check not supported." }
    }

    const { paymentDevMode } = await getPaymentSettings()
    const subscription = await provider.getSubscriptionStatus(subscriptionId, paymentDevMode)

    if (subscription.companyId !== companyId) {
      console.error(
        `PayPal subscription ${subscriptionId} companyId "${subscription.companyId}" does not match caller "${companyId}".`,
      )
      return { ok: false, error: "This subscription does not belong to your company." }
    }

    if (!subscription.packageSlug) {
      console.error(`PayPal subscription ${subscriptionId} has no packageSlug in its custom_id.`)
      return { ok: false, error: "Could not determine which package this subscription is for." }
    }

    // PayPal can take a moment after approval to flip the subscription to
    // ACTIVE, so poll briefly here instead of pushing that wait onto the
    // user as a manual page refresh.
    let status = subscription.status
    for (let attempt = 1; status !== "ACTIVE" && attempt < ACTIVATION_STATUS_RETRY_ATTEMPTS; attempt++) {
      await sleep(ACTIVATION_STATUS_RETRY_DELAY_MS)
      status = (await provider.getSubscriptionStatus(subscriptionId, paymentDevMode)).status
    }

    if (status !== "ACTIVE") {
      console.error(`PayPal subscription ${subscriptionId} still not ACTIVE after retries: status="${status}".`)
      return { ok: false, error: "Subscription is not active yet." }
    }

    const companyPackage = await handlePaymentSuccess(
      companyId,
      subscription.packageSlug,
      "paypal",
      subscriptionId,
      subscription.providerCustomerId,
    )
    // No revalidatePath here: this action runs directly during page.tsx's
    // render (not as a form-bound action), and Next.js disallows calling
    // revalidatePath during render. page.tsx is `force-dynamic` and
    // re-fetches getCompanyPackage right after this call anyway, and on
    // success it redirects to a clean URL, which renders fresh regardless.
    return { ok: true, companyPackage }
  } catch (error) {
    console.error(`Failed to confirm PayPal subscription ${subscriptionId}:`, error)
    return { ok: false, error: error instanceof Error ? error.message : "Could not confirm payment." }
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
