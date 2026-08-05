import Stripe from "stripe"
import type {
  PaymentProvider,
  CreateCheckoutParams,
  CheckoutResult,
  WebhookEvent,
  WebhookHeaders,
  PlanRefParams,
  ReviseSubscriptionParams,
  ReviseSubscriptionResult,
} from "./types"

export function getStripe(devMode?: boolean): Stripe {
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

const STRIPE_PRODUCT_NAME = "Poolbench Subscription"

/**
 * Every package's Price must belong to a Product. Rather than one Product per
 * package, all packages share this one — created once, found by name on every
 * later call (same idempotent create-or-find pattern as PayPal's ensureProduct;
 * no separate caching needed since this only runs when a package's Price
 * hasn't been created yet).
 */
async function ensureStripeProduct(devMode?: boolean): Promise<string> {
  const stripe = getStripe(devMode)

  const products = await stripe.products.list({ limit: 100 })
  const match = products.data.find((p) => p.name === STRIPE_PRODUCT_NAME && p.active)
  if (match) return match.id

  const product = await stripe.products.create({ name: STRIPE_PRODUCT_NAME })
  return product.id
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

  async createPlanRef(params: PlanRefParams, devMode?: boolean): Promise<string> {
    const stripe = getStripe(devMode)
    const productId = await ensureStripeProduct(devMode)

    const price = await stripe.prices.create({
      product: productId,
      unit_amount: params.price,
      currency: "usd",
      recurring: { interval: "month" },
      nickname: params.name,
    })

    return price.id
  },

  async reviseSubscription(
    params: ReviseSubscriptionParams,
    devMode?: boolean,
  ): Promise<ReviseSubscriptionResult> {
    const stripe = getStripe(devMode)

    const subscription = await stripe.subscriptions.retrieve(params.subscriptionId)
    const currentItemId = subscription.items.data[0]?.id
    if (!currentItemId) {
      throw new Error(`Stripe subscription ${params.subscriptionId} has no line items to revise.`)
    }

    const updated = await stripe.subscriptions.update(params.subscriptionId, {
      items: [{ id: currentItemId, price: params.newPlanRef }],
      proration_behavior: params.isUpgrade ? "always_invoice" : "none",
      expand: ["latest_invoice"],
    })

    let prorationAmount: number | undefined
    if (params.isUpgrade && updated.latest_invoice && typeof updated.latest_invoice !== "string") {
      prorationAmount = updated.latest_invoice.amount_due
    }

    return { status: "applied", prorationAmount }
  },

  async getCurrentPeriodEnd(subscriptionId: string, devMode?: boolean): Promise<Date> {
    const stripe = getStripe(devMode)
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const currentPeriodEnd = subscription.items.data[0]?.current_period_end
    if (!currentPeriodEnd) {
      throw new Error(`Stripe subscription ${subscriptionId} has no current_period_end.`)
    }
    return new Date(currentPeriodEnd * 1000)
  },
}
