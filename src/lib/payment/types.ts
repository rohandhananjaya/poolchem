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

export interface PaymentProvider {
  name: PaymentProviderName
  createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult>
  handleWebhook(payload: unknown, headers: WebhookHeaders): Promise<WebhookEvent>
  cancelSubscription(subscriptionId: string): Promise<void>
}

export interface PaymentSettings {
  stripeEnabled: boolean
  paypalEnabled: boolean
  paymentDevMode: boolean
}
