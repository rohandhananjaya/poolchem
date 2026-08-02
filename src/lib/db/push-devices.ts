/**
 * Data access for {@link PushDevice} — native devices (Android/iOS) registered
 * to receive push notifications.
 *
 * Tenant-scoped like every other record: `companyId` mirrors the owning user's
 * company. Reads/writes never happen without a `companyId`, so a device can
 * never leak across tenants.
 */
import "server-only";

import { prisma } from "@/lib/prisma";
import type { PushPlatform } from "@/generated/prisma/client";

export interface RegisterPushDeviceInput {
  companyId: string;
  userId: string;
  platform: PushPlatform;
  token: string;
}

/**
 * Upserts a device token for a user. Tokens are provider-generated (FCM/APNs)
 * and rotate, so re-registering with an existing token updates its owner.
 */
export async function registerPushDevice(input: RegisterPushDeviceInput) {
  return prisma.pushDevice.upsert({
    where: { token: input.token },
    update: {
      userId: input.userId,
      companyId: input.companyId,
      platform: input.platform,
    },
    create: {
      userId: input.userId,
      companyId: input.companyId,
      platform: input.platform,
      token: input.token,
    },
  });
}

/**
 * Removes a device token for a user — called on sign-out or when a push
 * provider reports the token as invalid. Scoped to the user's company.
 *
 * @returns The number of devices removed (0 or 1).
 */
export async function unregisterPushDevice(input: {
  companyId: string;
  userId: string;
  token: string;
}): Promise<number> {
  const result = await prisma.pushDevice.deleteMany({
    where: {
      token: input.token,
      companyId: input.companyId,
      userId: input.userId,
    },
  });
  return result.count;
}

/**
 * Returns all push devices registered to a user within their company — the
 * delivery targets for a notification about an event involving that user.
 */
export async function getPushDevicesForUser(
  companyId: string,
  userId: string,
) {
  return prisma.pushDevice.findMany({
    where: { companyId, userId },
    orderBy: { createdAt: "asc" },
  });
}
