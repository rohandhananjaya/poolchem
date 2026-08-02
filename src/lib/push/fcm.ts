/**
 * Firebase Cloud Messaging (HTTP v1) provider — delivers pushes to Android
 * devices registered with `@capacitor/push-notifications`.
 *
 * Configured via `FCM_SERVICE_ACCOUNT_JSON` (the full service-account JSON from
 * the Firebase console: project_id, client_email, private_key). When it's
 * unset, `createFcmProvider()` returns `null` and pushes are skipped.
 */
import "server-only";

import type { PushPayload, PushProvider, PushTarget } from "./types";
import { signJwt } from "./jwt";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

interface FcmServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

let cachedAccessToken: {
  email: string;
  token: string;
  expiresAt: number;
} | null = null;

function loadServiceAccount(): FcmServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<FcmServiceAccount>;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      return null;
    }
    return parsed as FcmServiceAccount;
  } catch {
    return null;
  }
}

/** Returns a (cached) OAuth2 access token minted from the service account. */
async function getAccessToken(account: FcmServiceAccount): Promise<string> {
  if (
    cachedAccessToken &&
    cachedAccessToken.email === account.client_email &&
    cachedAccessToken.expiresAt > Date.now()
  ) {
    return cachedAccessToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt({
    header: { alg: "RS256", typ: "JWT" },
    payload: {
      iss: account.client_email,
      scope: FCM_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    },
    key: account.private_key,
    algorithm: "RS256",
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `FCM OAuth token request failed: ${response.status} ${await response.text()}`,
    );
  }

  const json = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) {
    throw new Error("FCM OAuth token request returned no access token.");
  }

  const expiresIn = (json.expires_in ?? 3600) * 1000;
  cachedAccessToken = {
    email: account.client_email,
    token: json.access_token,
    expiresAt: Date.now() + expiresIn - 60_000,
  };
  return cachedAccessToken.token;
}

export function createFcmProvider(): PushProvider | null {
  const account = loadServiceAccount();
  if (!account) return null;

  return {
    async send(target: PushTarget, payload: PushPayload) {
      const accessToken = await getAccessToken(account);
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: target.token,
              notification: { title: payload.title, body: payload.body },
              data: payload.data ?? {},
              android: { priority: "HIGH" },
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `FCM send failed: ${response.status} ${await response.text()}`,
        );
      }
    },
  };
}
