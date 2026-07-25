import Stripe from "stripe"
import type { PaymentProvider, CreateCheckoutParams, CheckoutResult, WebhookEvent, WebhookHeaders } from "./types"

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.")
  return new Stripe(key)
}

export const stripeProvider: PaymentProvider = {
  name: "stripe",

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const stripe = getStripe()
    const unitAmount = params.price

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: params.name },
            unit_amount: unitAmount,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      client_reference_id: params.companyId,
      metadata: {
        companyId: params.companyId,
        packageSlug: params.packageSlug,
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    })

    if (!session.url) {
      throw new Error("Stripe Checkout did not return a URL.")
    }

    return { url: session.url, sessionId: session.id }
  },

  async handleWebhook(
    payload: unknown,
    headers: WebhookHeaders,
  ): Promise<WebhookEvent> {
    const stripe = getStripe()
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set.")

    const signature = headers["stripe-signature"]
    if (!signature) throw new Error("Missing stripe-signature header.")

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(
        payload as string,
        signature,
        secret,
      )
    } catch {
      throw new Error("Stripe webhook signature verification failed.")
    }

    const obj = event.data.object as unknown as Record<string, unknown>

    switch (event.type) {
      case "checkout.session.completed": {
        const companyId = obj.metadata as Record<string, string> | undefined
        const sessionCompanyId = companyId?.companyId
        const packageSlug = companyId?.packageSlug
        if (!sessionCompanyId) {
          throw new Error("Missing companyId in session metadata.")
        }
        return {
          event: "subscription_activated",
          providerSubscriptionId: obj.subscription as string,
          providerCustomerId: obj.customer as string,
          companyId: sessionCompanyId,
          packageSlug,
        }
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const status = obj.status as string
        return {
          event:
            status === "canceled" || status === "incomplete_expired"
              ? "subscription_cancelled"
              : "subscription_activated",
          providerSubscriptionId: obj.id as string,
          providerCustomerId: obj.customer as string,
        }
      }

      case "invoice.payment_failed": {
        return {
          event: "payment_failed",
          providerSubscriptionId: obj.subscription as string,
          providerCustomerId: obj.customer as string,
        }
      }

      default:
        throw new Error(`Unhandled Stripe event type: ${event.type}`)
    }
  },

  async cancelSubscription(subscriptionId: string): Promise<void> {
    const stripe = getStripe()
    await stripe.subscriptions.cancel(subscriptionId)
  },
}
