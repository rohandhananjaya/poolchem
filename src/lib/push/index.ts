/**
 * Push dispatch: routes a notification to the FCM (Android) or APNs (iOS)
 * provider. The single entry point used by the rest of the app — never import
 * the providers directly.
 *
 * Providers are environment-gated and lazily constructed once. A missing
 * provider config is a silent no-op; a failing provider logs and is swallowed,
 * so push can never break the server action that triggered it.
 */
import "server-only";

import type { PushPayload, PushProvider, PushTarget } from "./types";
import { createApnsProvider } from "./apns";
import { createFcmProvider } from "./fcm";

let fcmProvider: PushProvider | null | undefined;
let apnsProvider: PushProvider | null | undefined;

function getProvider(platform: PushTarget["platform"]): PushProvider | null {
  if (platform === "ANDROID") {
    if (fcmProvider === undefined) fcmProvider = createFcmProvider();
    return fcmProvider;
  }
  if (apnsProvider === undefined) apnsProvider = createApnsProvider();
  return apnsProvider;
}

/**
 * Sends a push notification to a single device. Resolves when the push was
 * accepted or skipped (provider unconfigured); never throws.
 */
export async function sendPush(
  target: PushTarget,
  payload: PushPayload,
): Promise<void> {
  const provider = getProvider(target.platform);
  if (!provider) return;

  try {
    await provider.send(target, payload);
  } catch (error) {
    console.error("sendPush:", error);
  }
}
