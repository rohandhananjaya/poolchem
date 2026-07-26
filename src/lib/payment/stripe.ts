import Stripe from "stripe"
import type { PaymentProvider, CreateCheckoutParams, CheckoutResult, WebhookEvent, WebhookHeaders } from "./types"

function getStripe(devMode?: boolean): Stripe {
  const key = devMode
    ? process.env.STRIPE_SECRET_KEY_SANDBOX
    : process.env.STRIPE_SECRET_KEY_LIVE
  if (!key) throw new Error(`STRIPE_SECRET_KEY_${devMode ? "SANDBOX" : "LIVE"} is not set.`)
  return new Stripe(key)
}

function getWebhookSecret(devMode?: boolean): string {
  const secret = devMode
    ? process.env.STRIPE_WEBHOOK_SECRET_SANDBOX
    : process.env.STRIPE_WEBHOOK_SECRET_LIVE
  if (!secret) throw new Error(`STRIPE_WEBHOOK_SECRET_${devMode ? "SANDBOX" : "LIVE"} is not set.`)
  return secret
}

export const stripeProvider: PaymentProvider = {
  name: "stripe",

  async createCheckout(params: CreateCheckoutParams, devMode?: boolean): Promise<CheckoutResult> {
    const stripe = getStripe(devMode)
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
    devMode?: boolean,
  ): Promise<WebhookEvent> {
    const stripe = getStripe(devMode)
    const secret = getWebhookSecret(devMode)

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

  async cancelSubscription(subscriptionId: string, devMode?: boolean): Promise<void> {
    const stripe = getStripe(devMode)
    await stripe.subscriptions.cancel(subscriptionId)
  },
}
