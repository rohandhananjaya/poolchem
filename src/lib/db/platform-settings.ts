import "server-only"

import { prisma } from "@/lib/prisma"

const SETTINGS_ID = "singleton"

export interface PlatformSettingsInfo {
  trialDays: number
  stripeEnabled: boolean
  paypalEnabled: boolean
  paymentDevMode: boolean
  feeBasedBilling: boolean
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
    feeBasedBilling: settings.feeBasedBilling,
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
    feeBasedBilling: settings.feeBasedBilling,
  }
}

/**
 * Flips the platform-wide fee-per-transaction flag. Turning it ON migrates every
 * currently trial/active company to `FEE_BASED` (full access, no subscription,
 * no monthly invoice). Turning it OFF only clears the flag — companies already
 * running `FEE_BASED` stay that way (migration is one-way per company).
 */
export async function updateFeeBasedBilling(enabled: boolean): Promise<PlatformSettingsInfo> {
  const settings = await prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { feeBasedBilling: enabled },
    create: { id: SETTINGS_ID, feeBasedBilling: enabled },
  })

  if (enabled) {
    await prisma.companyPackage.updateMany({
      where: { status: { in: ["TRIAL", "ACTIVE", "EXPIRED", "CANCELLED"] } },
      data: {
        status: "FEE_BASED",
        packageId: null,
        trialStart: null,
        trialEnd: null,
        paidAt: null,
        pendingPackageId: null,
        pendingEffectiveAt: null,
      },
    })
  }

  return {
    trialDays: settings.trialDays,
    stripeEnabled: settings.stripeEnabled,
    paypalEnabled: settings.paypalEnabled,
    paymentDevMode: settings.paymentDevMode,
    feeBasedBilling: settings.feeBasedBilling,
  }
}
