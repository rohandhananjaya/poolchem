import "server-only"

import { prisma } from "@/lib/prisma"

const SETTINGS_ID = "singleton"

export interface PlatformSettingsInfo {
  trialDays: number
  stripeEnabled: boolean
  paypalEnabled: boolean
  paymentDevMode: boolean
}

export async function getPlatformSettings(): Promise<PlatformSettingsInfo> {
  const settings = await prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  })
  return {
    trialDays: settings.trialDays,
    stripeEnabled: settings.stripeEnabled,
    paypalEnabled: settings.paypalEnabled,
    paymentDevMode: settings.paymentDevMode,
  }
}

export async function updateTrialDays(days: number): Promise<PlatformSettingsInfo> {
  const settings = await prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { trialDays: days },
    create: { id: SETTINGS_ID, trialDays: days },
  })
  return {
    trialDays: settings.trialDays,
    stripeEnabled: settings.stripeEnabled,
    paypalEnabled: settings.paypalEnabled,
    paymentDevMode: settings.paymentDevMode,
  }
}
