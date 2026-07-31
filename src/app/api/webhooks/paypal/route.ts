import { NextResponse } from "next/server"
import { paypalProvider } from "@/lib/payment/paypal"
import { handlePaymentSuccess, handleSubscriptionCancelled, handlePlanRevisionConfirmed } from "@/lib/db/packages"
import { getPaymentSettings } from "@/lib/db/payment-settings"
import { getCompanyBySubscriptionId } from "@/lib/db/company"

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
    }

    if (event.event === "subscription_plan_changed" && event.companyId && event.providerPlanId) {
      await handlePlanRevisionConfirmed(event.companyId, event.providerPlanId)
    }

    if (event.event === "subscription_cancelled") {
      // If this id no longer matches any company's currently-recorded active
      // subscription, it's a stale cancellation — e.g. the side effect of our
      // own cross-provider switch, which already cleared this id — ignore it.
      const company = await getCompanyBySubscriptionId("paypal", event.providerSubscriptionId)
      if (company) {
        await handleSubscriptionCancelled(company.id)
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook error"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
