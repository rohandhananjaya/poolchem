import type { PaymentProvider, CreateCheckoutParams, CheckoutResult, WebhookEvent, WebhookHeaders } from "./types"

const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com"
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID ?? ""

interface PayPalAccessToken {
  access_token: string
  token_type: string
  expires_in: number
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is not set.")
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`PayPal auth failed (${res.status}): ${body}`)
  }

  const data = (await res.json()) as PayPalAccessToken
  return data.access_token
}

async function paypalFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()
  return fetch(`${PAYPAL_API_BASE}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })
}

export const paypalProvider: PaymentProvider = {
  name: "paypal",

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const unitAmount = (params.price / 100).toFixed(2)

    const planRes = await paypalFetch("/v1/billing/plans", {
      method: "POST",
      body: JSON.stringify({
        product_id: "POOLBENCH_SUBSCRIPTION",
        name: params.name,
        description: `${params.name} — monthly subscription`,
        billing_cycles: [
          {
            frequency: { interval_unit: "MONTH", interval_count: 1 },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: {
                value: unitAmount,
                currency_code: "USD",
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: { value: "0.00", currency_code: "USD" },
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
        metadata: JSON.stringify({
          companyId: params.companyId,
          packageSlug: params.packageSlug,
        }),
      }),
    })

    if (!planRes.ok) {
      const body = await planRes.text()
      throw new Error(`PayPal plan creation failed (${planRes.status}): ${body}`)
    }

    const plan = await planRes.json()

    const subRes = await paypalFetch("/v1/billing/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: plan.id,
        start_time: new Date(Date.now() + 60000).toISOString(),
        quantity: "1",
        custom_id: params.companyId,
        application_context: {
          brand_name: "Poolbench",
          locale: "en-US",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          payment_method: {
            payer_selected: "PAYPAL",
            payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED",
          },
          return_url: params.successUrl,
          cancel_url: params.cancelUrl,
        },
      }),
    })

    if (!subRes.ok) {
      const body = await subRes.text()
      throw new Error(`PayPal subscription creation failed (${subRes.status}): ${body}`)
    }

    const sub = await subRes.json()

    const approvalLink = sub.links?.find(
      (l: { rel: string; href: string }) => l.rel === "approve",
    )?.href

    if (!approvalLink) {
      throw new Error("PayPal did not return an approval URL.")
    }

    return { url: approvalLink, sessionId: sub.id }
  },

  async handleWebhook(
    payload: unknown,
    headers: WebhookHeaders,
  ): Promise<WebhookEvent> {
    if (!PAYPAL_WEBHOOK_ID) {
      throw new Error("PAYPAL_WEBHOOK_ID is not set.")
    }

    const body = payload as string
    let parsed: { event_type: string; resource: Record<string, unknown> }

    try {
      parsed = JSON.parse(body)
    } catch {
      throw new Error("Invalid PayPal webhook payload.")
    }

    const { event_type, resource } = parsed

    const verification = await fetch(
      `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await getAccessToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auth_algo: headers["paypal-auth-algo"] ?? "",
          cert_url: headers["paypal-cert-url"] ?? "",
          transmission_id: headers["paypal-transmission-id"] ?? "",
          transmission_sig: headers["paypal-transmission-sig"] ?? "",
          transmission_time: headers["paypal-transmission-time"] ?? "",
          webhook_id: PAYPAL_WEBHOOK_ID,
          webhook_event: parsed,
        }),
      },
    )

    if (!verification.ok) {
      throw new Error("PayPal webhook verification failed.")
    }

    const verificationResult = await verification.json()
    if (verificationResult.verification_status !== "SUCCESS") {
      throw new Error("PayPal webhook signature invalid.")
    }

    const resourceId = resource.id as string
    const customId = resource.custom_id as string | undefined

    async function getPlanMetadata(
      planId: string,
    ): Promise<{ companyId?: string; packageSlug?: string }> {
      try {
        const planRes = await paypalFetch(`/v1/billing/plans/${planId}`)
        if (!planRes.ok) return {}
        const planData = await planRes.json()
        const metaStr = planData.metadata as string | undefined
        if (!metaStr) return {}
        return JSON.parse(metaStr)
      } catch {
        return {}
      }
    }

    switch (event_type) {
      case "BILLING.SUBSCRIPTION.ACTIVATED": {
        const planId = resource.plan_id as string | undefined
        const meta = planId ? await getPlanMetadata(planId) : {}
        return {
          event: "subscription_activated",
          providerSubscriptionId: resourceId,
          providerCustomerId: (resource.subscriber as Record<string, unknown>)?.email_address as string ?? "",
          companyId: customId ?? meta.companyId,
          packageSlug: meta.packageSlug,
        }
      }

      case "PAYMENT.SALE.COMPLETED": {
        const billingAgreementId = resource.billing_agreement_id as string | undefined
        let subscriptionId = resourceId
        let companyId = customId
        let packageSlug: string | undefined

        if (billingAgreementId) {
          subscriptionId = billingAgreementId
          const subRes = await paypalFetch(
            `/v1/billing/subscriptions/${billingAgreementId}`,
          )
          if (subRes.ok) {
            const subData = await subRes.json()
            companyId = subData.custom_id as string | undefined
            const planId = subData.plan_id as string | undefined
            if (planId) {
              const meta = await getPlanMetadata(planId)
              packageSlug = meta.packageSlug
            }
          }
        }

        if (!companyId) {
          throw new Error("Missing companyId in PayPal webhook payload.")
        }

        return {
          event: "subscription_activated",
          providerSubscriptionId: subscriptionId,
          providerCustomerId: resource.payer_email as string,
          companyId,
          packageSlug,
        }
      }

      case "BILLING.SUBSCRIPTION.CANCELLED":
        return {
          event: "subscription_cancelled",
          providerSubscriptionId: resourceId,
          providerCustomerId: (resource.subscriber as Record<string, unknown>)?.email_address as string ?? "",
        }

      default:
        throw new Error(`Unhandled PayPal event type: ${event_type}`)
    }
  },

  async cancelSubscription(subscriptionId: string): Promise<void> {
    const res = await paypalFetch(
      `/v1/billing/subscriptions/${subscriptionId}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ reason: "Cancelled by admin." }),
      },
    )

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`PayPal cancel failed (${res.status}): ${body}`)
    }
  },
}
