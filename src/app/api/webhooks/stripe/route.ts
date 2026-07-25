import { NextResponse } from "next/server"
import { stripeProvider } from "@/lib/payment/stripe"
import { handlePaymentSuccess } from "@/lib/db/packages"

export async function POST(request: Request) {
  const rawBody = await request.text()

  try {
    const event = await stripeProvider.handleWebhook(rawBody, {
      "stripe-signature": request.headers.get("stripe-signature") ?? undefined,
    })

    if (event.event === "subscription_activated" && event.companyId && event.packageSlug) {
      await handlePaymentSuccess(
        event.companyId,
        event.packageSlug,
        "stripe",
        event.providerSubscriptionId,
        event.providerCustomerId,
      )
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook error"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
