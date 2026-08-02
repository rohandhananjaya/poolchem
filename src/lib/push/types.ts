import type { PushPlatform } from "@/generated/prisma/client";

/** A push message to deliver to one device. */
export interface PushPayload {
  title: string;
  body: string;
  /** Flat string map delivered with the notification (e.g. `visitId`). */
  data?: Record<string, string>;
}

/** A single registered device, as stored by {@link PushDevice}. */
export interface PushTarget {
  token: string;
  platform: PushPlatform;
}

/**
 * A platform push sender (FCM or APNs). Implementations are environment-gated:
 * a provider that isn't configured is never constructed, and `send()` throws
 * on failure so callers can decide how to handle it.
 */
export interface PushProvider {
  send(target: PushTarget, payload: PushPayload): Promise<void>;
}
