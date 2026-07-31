export type PaymentProviderName = "stripe" | "paypal"

export interface CreateCheckoutParams {
  companyId: string
  packageSlug: string
  price: number
  name: string
  successUrl: string
  cancelUrl: string
  /** Pre-resolved, cached plan/price ref (from createPlanRef) — skips creating a fresh one per checkout. */
  planRef?: string
}

export interface CheckoutResult {
  url: string
  sessionId: string
}

export interface WebhookEvent {
  event: "subscription_activated" | "subscription_cancelled" | "payment_failed" | "subscription_plan_changed"
  providerSubscriptionId: string
  providerCustomerId: string
  companyId?: string
  packageSlug?: string
  /** Set only for `subscription_plan_changed` — the plan the subscription now sits on, used to look up which Package it corresponds to (the webhook's custom_id still reflects the ORIGINAL signup package, not the revised one). */
  providerPlanId?: string
}

export interface WebhookHeaders {
  "stripe-signature"?: string
  "paypal-transmission-id"?: string
  "paypal-transmission-sig"?: string
  "paypal-transmission-time"?: string
  "paypal-auth-algo"?: string
  "paypal-cert-url"?: string
}

export interface SubscriptionStatus {
  status: string
  providerCustomerId: string
  companyId?: string
  packageSlug?: string
  /** The plan the subscription is currently on — used to confirm a revise actually took effect after subscriber re-approval. */
  planId?: string
}

export interface PlanRefParams {
  slug: string
  name: string
  price: number // cents
}

export interface ReviseSubscriptionParams {
  subscriptionId: string
  /** Stripe price id, or PayPal plan id — the stable ref returned by createPlanRef. */
  newPlanRef: string
  /** Drives proration/billing behavior: upgrades bill the difference now, downgrades don't. */
  isUpgrade: boolean
  /** Where PayPal sends the subscriber if the revise needs their re-approval. Ignored by Stripe (never requires re-approval). */
  successUrl?: string
  cancelUrl?: string
}

export interface ReviseSubscriptionResult {
  status: "applied" | "requires_approval"
  /** Set only when status is "requires_approval" — where to send the subscriber to re-approve. */
  approvalUrl?: string
  /** Best-effort prorated amount charged, in cents. Only meaningful for upgrades. */
  prorationAmount?: number
}

export interface PaymentProvider {
  name: PaymentProviderName
  createCheckout(params: CreateCheckoutParams, devMode?: boolean): Promise<CheckoutResult>
  handleWebhook(payload: unknown, headers: WebhookHeaders, devMode?: boolean): Promise<WebhookEvent>
  cancelSubscription(subscriptionId: string, devMode?: boolean): Promise<void>
  /** Synchronous status check for providers whose webhook can't be reached (e.g. local dev). */
  getSubscriptionStatus?(subscriptionId: string, devMode?: boolean): Promise<SubscriptionStatus>
  /** Creates (once) a stable, reusable plan/price reference for a package. */
  createPlanRef(params: PlanRefParams, devMode?: boolean): Promise<string>
  /** Switches an existing subscription to a different plan in place, instead of cancel+recreate. */
  reviseSubscription(params: ReviseSubscriptionParams, devMode?: boolean): Promise<ReviseSubscriptionResult>
  /** Live read of when the current paid period ends, used only when scheduling a downgrade. */
  getCurrentPeriodEnd(subscriptionId: string, devMode?: boolean): Promise<Date>
}

export interface PaymentSettings {
  stripeEnabled: boolean
  paypalEnabled: boolean
  paymentDevMode: boolean
}
