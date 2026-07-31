export type PaymentProviderName = "stripe" | "paypal"

export interface CreateCheckoutParams {
  companyId: string
  packageSlug: string
  price: number
  name: string
  successUrl: string
  cancelUrl: string
}

export interface CheckoutResult {
  url: string
  sessionId: string
}

export interface WebhookEvent {
  event: "subscription_activated" | "subscription_cancelled" | "payment_failed"
  providerSubscriptionId: string
  providerCustomerId: string
  companyId?: string
  packageSlug?: string
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
}

export interface PaymentProvider {
  name: PaymentProviderName
  createCheckout(params: CreateCheckoutParams, devMode?: boolean): Promise<CheckoutResult>
  handleWebhook(payload: unknown, headers: WebhookHeaders, devMode?: boolean): Promise<WebhookEvent>
  cancelSubscription(subscriptionId: string, devMode?: boolean): Promise<void>
  /** Synchronous status check for providers whose webhook can't be reached (e.g. local dev). */
  getSubscriptionStatus?(subscriptionId: string, devMode?: boolean): Promise<SubscriptionStatus>
}

export interface PaymentSettings {
  stripeEnabled: boolean
  paypalEnabled: boolean
  paymentDevMode: boolean
}
