"use server";

import { requireAuth } from "@/lib/auth";
import {
  registerPushDevice,
  unregisterPushDevice,
} from "@/lib/db/push-devices";
import { PushPlatform } from "@/generated/prisma/client";

/** Result returned to the client push-registration hook. */
export interface PushRegistrationResult {
  ok: boolean;
  error?: string;
}

const VALID_PLATFORMS = new Set<string>(Object.values(PushPlatform));

/**
 * Registers a native device token for the signed-in user. Tokens are
 * provider-generated (FCM/APNs) and re-registered whenever the native app
 * starts or the token rotates.
 */
export async function registerPushDeviceAction(input: {
  token: string;
  platform: PushPlatform;
}): Promise<PushRegistrationResult> {
  const user = await requireAuth();
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation." };
  }
  if (!input.token || !VALID_PLATFORMS.has(input.platform)) {
    return { ok: false, error: "Invalid device registration." };
  }

  await registerPushDevice({
    companyId: user.companyId,
    userId: user.id,
    token: input.token,
    platform: input.platform,
  });
  return { ok: true };
}

/**
 * Removes a device token — called when the native app signs out or a push
 * provider reports the token as no longer valid.
 */
export async function unregisterPushDeviceAction(
  token: string,
): Promise<PushRegistrationResult> {
  const user = await requireAuth();
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation." };
  }
  if (!token) {
    return { ok: false, error: "Missing device token." };
  }

  await unregisterPushDevice({
    companyId: user.companyId,
    userId: user.id,
    token,
  });
  return { ok: true };
}
