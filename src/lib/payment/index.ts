import "server-only"

import type { PaymentProvider, PaymentSettings, PaymentProviderName } from "./types"
import { stripeProvider } from "./stripe"
import { paypalProvider } from "./paypal"
import { getPaymentSettings } from "@/lib/db/payment-settings"

const providers: Record<PaymentProviderName, PaymentProvider> = {
  stripe: stripeProvider,
  paypal: paypalProvider,
}

export type { PaymentProviderName, PaymentProvider, PaymentSettings } from "./types"

export async function getActiveProviders(): Promise<PaymentProvider[]> {
  const settings = await getPaymentSettings()
  const active: PaymentProvider[] = []

  if (settings.stripeEnabled) active.push(providers.stripe)
  if (settings.paypalEnabled) active.push(providers.paypal)

  return active
}

export async function getProvider(name: PaymentProviderName): Promise<PaymentProvider> {
  return providers[name]
}
