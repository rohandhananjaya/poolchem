import { NextResponse } from "next/server"
import { paypalProvider } from "@/lib/payment/paypal"
import { handlePaymentSuccess } from "@/lib/db/packages"

export async function POST(request: Request) {
  const rawBody = await request.text()

  try {
    const event = await paypalProvider.handleWebhook(rawBody, {
      "paypal-transmission-id": request.headers.get("paypal-transmission-id") ?? undefined,
      "paypal-transmission-sig": request.headers.get("paypal-transmission-sig") ?? undefined,
      "paypal-transmission-time": request.headers.get("paypal-transmission-time") ?? undefined,
      "paypal-auth-algo": request.headers.get("paypal-auth-algo") ?? undefined,
      "paypal-cert-url": request.headers.get("paypal-cert-url") ?? undefined,
    })

    if (event.event === "subscription_activated" && event.companyId && event.packageSlug) {
      await handlePaymentSuccess(
        event.companyId,
        event.packageSlug,
        "paypal",
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
