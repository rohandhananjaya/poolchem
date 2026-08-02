/**
 * Apple Push Notification service (HTTP/2) provider — delivers pushes to iOS
 * devices registered with `@capacitor/push-notifications`.
 *
 * Configured via:
 * - `APNS_TEAM_ID` — your Apple Developer team id
 * - `APNS_KEY_ID` — the key id of the push-notification .p8 key
 * - `APNS_KEY` — the .p8 file's contents (PEM, or raw PKCS#8 which is wrapped)
 * - `APNS_TOPIC` — bundle id to send to (defaults to `com.poolbench.app`)
 * - `APNS_SANDBOX` — `"true"` to hit the sandbox gateway (development builds)
 *
 * When any of the required vars are unset, `createApnsProvider()` returns
 * `null` and pushes are skipped.
 */
import "server-only";

import http2 from "node:http2";

import type { PushPayload, PushProvider, PushTarget } from "./types";
import { signJwt } from "./jwt";

const PEM_BEGIN = "-----BEGIN PRIVATE KEY-----";
const PEM_END = "-----END PRIVATE KEY-----";

interface ApnsConfig {
  teamId: string;
  keyId: string;
  key: string;
  topic: string;
  sandbox: boolean;
}

function toPem(key: string): string {
  if (key.includes("-----BEGIN")) return key;
  const b64 = key.replace(/\s+/g, "");
  const lines = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `${PEM_BEGIN}\n${lines}\n${PEM_END}`;
}

function loadApnsConfig(): ApnsConfig | null {
  const teamId = process.env.APNS_TEAM_ID;
  const keyId = process.env.APNS_KEY_ID;
  const key = process.env.APNS_KEY;
  if (!teamId || !keyId || !key) return null;

  return {
    teamId,
    keyId,
    key: toPem(key),
    topic: process.env.APNS_TOPIC ?? "com.poolbench.app",
    sandbox: process.env.APNS_SANDBOX === "true",
  };
}

function createApnsToken(config: ApnsConfig): string {
  return signJwt({
    header: { alg: "ES256", kid: config.keyId },
    payload: { iss: config.teamId, iat: Math.floor(Date.now() / 1000) },
    key: config.key,
    algorithm: "ES256",
  });
}

export function createApnsProvider(): PushProvider | null {
  const config = loadApnsConfig();
  if (!config) return null;

  const host = config.sandbox
    ? "api.sandbox.push.apple.com"
    : "api.push.apple.com";

  return {
    async send(target: PushTarget, payload: PushPayload) {
      const token = createApnsToken(config);
      const body = JSON.stringify({
        aps: {
          alert: { title: payload.title, body: payload.body },
          sound: "default",
        },
        ...(payload.data ?? {}),
      });

      await new Promise<void>((resolve, reject) => {
        const client = http2.connect(`https://${host}`);
        const fail = (err: Error) => {
          client.close();
          reject(err);
        };

        client.on("error", fail);

        const request = client.request({
          ":method": "POST",
          ":path": `/3/device/${target.token}`,
          authorization: `bearer ${token}`,
          "apns-topic": config.topic,
          "apns-push-type": "alert",
          "apns-priority": "10",
          "content-length": Buffer.byteLength(body),
        });

        let status = 0;
        let responseBody = "";
        request.on("response", (headers) => {
          status = Number(headers[":status"] ?? 0);
        });
        request.on("data", (chunk: Buffer) => {
          responseBody += chunk;
        });
        request.on("end", () => {
          client.close();
          if (status >= 200 && status < 300) {
            resolve();
          } else {
            reject(
              new Error(`APNs send failed: ${status} ${responseBody.trim()}`),
            );
          }
        });
        request.on("error", fail);
        request.end(body);
      });
    },
  };
}
