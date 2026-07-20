import "server-only"

import { prisma } from "@/lib/prisma"

const SETTINGS_ID = "singleton"

export interface PlatformSettingsInfo {
  trialDays: number
}

export async function getPlatformSettings(): Promise<PlatformSettingsInfo> {
  const settings = await prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  })
  return { trialDays: settings.trialDays }
}

export async function updateTrialDays(days: number): Promise<PlatformSettingsInfo> {
  const settings = await prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { trialDays: days },
    create: { id: SETTINGS_ID, trialDays: days },
  })
  return { trialDays: settings.trialDays }
}
