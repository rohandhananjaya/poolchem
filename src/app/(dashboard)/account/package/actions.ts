"use server"

import { revalidatePath } from "next/cache"

import { getCompanyId } from "@/lib/auth"
import {
  simulatePayment,
  startTrial,
  getCompanyPackage,
  handlePaymentSuccess,
  upgradeCompanyPackage,
  scheduleDowngrade,
  cancelPendingDowngrade,
  simulateSwitch,
  getCheckoutPlanRef,
  confirmPendingUpgrade,
} from "@/lib/db/packages"
import { getPackageBySlug } from "@/lib/db/packages"
import { getActiveProviders, getProvider } from "@/lib/payment"
import { getPaymentSettings } from "@/lib/db/payment-settings"
import { getCompanyById } from "@/lib/db/company"
import { notifyPaymentSuccess, notifyDowngradeScheduled } from "@/lib/email/notify"
import type { CompanyPackageInfo } from "@/lib/package-features"
import type { PaymentProviderName } from "@/lib/payment/types"

export interface PaymentActionState {
  ok: boolean
  error?: string
  companyPackage?: CompanyPackageInfo
  redirectUrl?: string
}

export interface SwitchPackageActionState {
  ok: boolean
  error?: string
  companyPackage?: CompanyPackageInfo
  kind?: "upgraded" | "downgrade_scheduled"
  effectiveAt?: string
  prorationAmount?: number
  /** Set when PayPal requires the subscriber to re-approve the plan change — redirect the browser here. */
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
      const planRef = await getCheckoutPlanRef(packageSlug, activeProvider.name, devMode)
      const result = await activeProvider.createCheckout({
        companyId,
        packageSlug,
        price: pkg.price,
        name: pkg.name,
        successUrl: `${baseUrl}/account/package?success=1`,
        cancelUrl: `${baseUrl}/account/package`,
        planRef,
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

    const planRef = await getCheckoutPlanRef(packageSlug, chosenProvider.name, devMode)
    const result = await chosenProvider.createCheckout({
      companyId,
      packageSlug,
      price: pkg.price,
      name: pkg.name,
      successUrl: `${baseUrl}/account/package?success=1`,
      cancelUrl: `${baseUrl}/account/package`,
      planRef,
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
    await notifyPaymentSuccessForCompany(companyId, companyPackage)
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

/**
 * Completes an upgrade PayPal sent the subscriber off to re-approve, called
 * from page.tsx's render when they're redirected back with `?paypal_upgrade=1`
 * — same "run it during render, no revalidatePath" reasoning as
 * `confirmPayPalSubscriptionAction` above.
 */
export async function confirmPayPalUpgradeAction(packageSlug: string): Promise<SwitchPackageActionState> {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return { ok: false, error: "No company found." }

    const companyPackage = await confirmPendingUpgrade(companyId, packageSlug)
    await notifyPaymentSuccessForCompany(companyId, companyPackage)
    return { ok: true, companyPackage, kind: "upgraded" }
  } catch (error) {
    console.error(`Failed to confirm PayPal upgrade to "${packageSlug}":`, error)
    return { ok: false, error: error instanceof Error ? error.message : "Could not confirm the upgrade." }
  }
}

/** Sends a payment-receipt email for a company whose package just activated. */
async function notifyPaymentSuccessForCompany(
  companyId: string,
  companyPackage: CompanyPackageInfo,
): Promise<void> {
  if (!companyPackage.package) return
  const company = await getCompanyById(companyId)
  if (!company) return
  await notifyPaymentSuccess({
    to: company.email,
    companyName: company.name,
    packageName: companyPackage.package.name,
    amount: companyPackage.package.price,
  })
}

/** Sends a confirmation when a downgrade is scheduled. */
async function notifyDowngradeScheduledForCompany(
  companyId: string,
  companyPackage: CompanyPackageInfo,
  effectiveAt: Date,
): Promise<void> {
  if (!companyPackage.package || !companyPackage.pendingPackage) return
  const company = await getCompanyById(companyId)
  if (!company) return
  await notifyDowngradeScheduled({
    to: company.email,
    companyName: company.name,
    currentPackageName: companyPackage.package.name,
    targetPackageName: companyPackage.pendingPackage.name,
    effectiveAt,
  })
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

/**
 * Switches a company already on an active paid plan to a different one.
 * Upgrades (higher price) apply immediately with provider-native proration.
 * Downgrades (lower price) are scheduled for the end of the current paid
 * period — the company keeps its current plan's features until then.
 */
export async function switchPackageAction(
  _prev: SwitchPackageActionState,
  formData: FormData,
): Promise<SwitchPackageActionState> {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return { ok: false, error: "No company found." }

    const targetSlug = formData.get("package") as string
    if (!targetSlug) return { ok: false, error: "No package selected." }

    const current = await getCompanyPackage(companyId)
    if (!current || current.status !== "ACTIVE" || !current.package) {
      return { ok: false, error: "You don't have an active plan to switch from." }
    }

    const target = await getPackageBySlug(targetSlug)
    if (!target) return { ok: false, error: "Package not found." }
    if (target.id === current.package.id) {
      return { ok: false, error: "You're already on this plan." }
    }

    if (target.price > current.package.price) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000"
      const outcome = await upgradeCompanyPackage(companyId, targetSlug, {
        successUrl: `${baseUrl}/account/package?paypal_upgrade=1&package=${targetSlug}`,
        cancelUrl: `${baseUrl}/account/package`,
      })

      if (outcome.status === "requires_approval") {
        return { ok: true, redirectUrl: outcome.approvalUrl }
      }

      await notifyPaymentSuccessForCompany(companyId, outcome.companyPackage)
      revalidatePath("/account/package")
      return {
        ok: true,
        companyPackage: outcome.companyPackage,
        kind: "upgraded",
        prorationAmount: outcome.prorationAmount,
      }
    }

    const { companyPackage, effectiveAt } = await scheduleDowngrade(companyId, targetSlug)
    await notifyDowngradeScheduledForCompany(companyId, companyPackage, effectiveAt)
    revalidatePath("/account/package")
    return {
      ok: true,
      companyPackage,
      kind: "downgrade_scheduled",
      effectiveAt: effectiveAt.toISOString(),
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not switch plans." }
  }
}

/** Cancels a downgrade that's scheduled but hasn't taken effect yet. */
export async function cancelScheduledDowngradeAction(): Promise<SwitchPackageActionState> {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return { ok: false, error: "No company found." }

    const companyPackage = await cancelPendingDowngrade(companyId)
    revalidatePath("/account/package")
    return { ok: true, companyPackage }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not cancel the scheduled change.",
    }
  }
}

/**
 * Dev/no-real-provider stand-in for `switchPackageAction`, mirroring how
 * `payNowAction` stands in for `createPaymentAction`. Not wired to any UI
 * button today (same as `payNowAction`) — available for local/manual testing
 * of the switch flow without real PayPal/Stripe credentials.
 */
export async function simulateSwitchAction(
  _prev: SwitchPackageActionState,
  formData: FormData,
): Promise<SwitchPackageActionState> {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return { ok: false, error: "No company found." }

    const targetSlug = formData.get("package") as string
    if (!targetSlug) return { ok: false, error: "No package selected." }

    const result = await simulateSwitch(companyId, targetSlug)
    revalidatePath("/account/package")
    return {
      ok: true,
      companyPackage: result.companyPackage,
      kind: result.kind,
      effectiveAt: result.effectiveAt?.toISOString(),
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not switch plans." }
  }
}
