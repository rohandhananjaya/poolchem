import "server-only"

import { prisma } from "@/lib/prisma"
import type { PaymentSettings } from "@/lib/payment/types"

const SETTINGS_ID = "singleton"

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const settings = await prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  })
  return {
    stripeEnabled: settings.stripeEnabled,
    paypalEnabled: settings.paypalEnabled,
    paymentDevMode: settings.paymentDevMode,
  }
}

export async function updatePaymentSettings(
  data: Partial<PaymentSettings>,
): Promise<PaymentSettings> {
  const settings = await prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {
      ...(data.stripeEnabled !== undefined && { stripeEnabled: data.stripeEnabled }),
      ...(data.paypalEnabled !== undefined && { paypalEnabled: data.paypalEnabled }),
      ...(data.paymentDevMode !== undefined && { paymentDevMode: data.paymentDevMode }),
    },
    create: {
      id: SETTINGS_ID,
      stripeEnabled: data.stripeEnabled ?? false,
      paypalEnabled: data.paypalEnabled ?? false,
      paymentDevMode: data.paymentDevMode ?? true,
    },
  })
  return {
    stripeEnabled: settings.stripeEnabled,
    paypalEnabled: settings.paypalEnabled,
    paymentDevMode: settings.paymentDevMode,
  }
}
