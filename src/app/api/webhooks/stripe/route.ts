import { NextResponse } from "next/server"
import { stripeProvider } from "@/lib/payment/stripe"
import { handlePaymentSuccess, handleSubscriptionCancelled } from "@/lib/db/packages"
import { getPaymentSettings } from "@/lib/db/payment-settings"
import { getCompanyBySubscriptionId } from "@/lib/db/company"

export async function POST(request: Request) {
  const rawBody = await request.text()
  const { paymentDevMode } = await getPaymentSettings()

  try {
    const event = await stripeProvider.handleWebhook(rawBody, {
      "stripe-signature": request.headers.get("stripe-signature") ?? undefined,
    }, paymentDevMode)

    if (event.event === "subscription_activated" && event.companyId && event.packageSlug) {
      await handlePaymentSuccess(
        event.companyId,
        event.packageSlug,
        "stripe",
        event.providerSubscriptionId,
        event.providerCustomerId,
      )
    }

    if (event.event === "subscription_cancelled") {
      // If this id no longer matches any company's currently-recorded active
      // subscription, it's a stale cancellation — e.g. the side effect of our
      // own cross-provider switch, which already cleared this id — ignore it.
      const company = await getCompanyBySubscriptionId("stripe", event.providerSubscriptionId)
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
