import { NextResponse } from "next/server"
import { paypalProvider } from "@/lib/payment/paypal"
import { handlePaymentSuccess, handleSubscriptionCancelled, handlePlanRevisionConfirmed, getPackageBySlug } from "@/lib/db/packages"
import { getPaymentSettings } from "@/lib/db/payment-settings"
import { getCompanyById, getCompanyBySubscriptionId } from "@/lib/db/company"
import { notifyPaymentSuccess, notifySubscriptionCancelled } from "@/lib/email/notify"

export async function POST(request: Request) {
  const rawBody = await request.text()
  const { paymentDevMode } = await getPaymentSettings()

  try {
    const event = await paypalProvider.handleWebhook(rawBody, {
      "paypal-transmission-id": request.headers.get("paypal-transmission-id") ?? undefined,
      "paypal-transmission-sig": request.headers.get("paypal-transmission-sig") ?? undefined,
      "paypal-transmission-time": request.headers.get("paypal-transmission-time") ?? undefined,
      "paypal-auth-algo": request.headers.get("paypal-auth-algo") ?? undefined,
      "paypal-cert-url": request.headers.get("paypal-cert-url") ?? undefined,
    }, paymentDevMode)

    if (event.event === "subscription_activated" && event.companyId && event.packageSlug) {
      await handlePaymentSuccess(
        event.companyId,
        event.packageSlug,
        "paypal",
        event.providerSubscriptionId,
        event.providerCustomerId,
      )
      await notifyPaymentSuccessForCompany(event.companyId, event.packageSlug)
    }

    if (event.event === "subscription_plan_changed" && event.companyId && event.providerPlanId) {
      const cp = await handlePlanRevisionConfirmed(event.companyId, event.providerPlanId)
      const company = await getCompanyById(event.companyId)
      if (company && cp.package) {
        await notifyPaymentSuccess({
          to: company.email,
          companyName: company.name,
          packageName: cp.package.name,
          amount: cp.package.price,
        })
      }
    }

    if (event.event === "subscription_cancelled") {
      // If this id no longer matches any company's currently-recorded active
      // subscription, it's a stale cancellation — e.g. the side effect of our
      // own cross-provider switch, which already cleared this id — ignore it.
      const company = await getCompanyBySubscriptionId("paypal", event.providerSubscriptionId)
      if (company) {
        const cp = await handleSubscriptionCancelled(company.id)
        await notifySubscriptionCancelled({
          to: company.email,
          companyName: company.name,
          packageName: cp.package?.name ?? null,
        })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook error"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

/** Sends a payment-receipt email for a company+package after a successful payment. */
async function notifyPaymentSuccessForCompany(
  companyId: string,
  packageSlug: string,
): Promise<void> {
  const [company, pkg] = await Promise.all([
    getCompanyById(companyId),
    getPackageBySlug(packageSlug),
  ])
  if (!company || !pkg) return
  await notifyPaymentSuccess({
    to: company.email,
    companyName: company.name,
    packageName: pkg.name,
    amount: pkg.price,
  })
}
