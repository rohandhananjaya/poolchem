/**
 * Dependency-free JWT signing for the push providers.
 *
 * FCM (HTTP v1) needs an RS256 signed assertion to mint an OAuth token; APNs
 * needs an ES256 signed token directly. Both are covered by Node's built-in
 * `crypto` — no `jsonwebtoken` dependency.
 */
import { createPrivateKey, createSign } from "node:crypto";

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

export type JwtAlgorithm = "RS256" | "ES256";

/**
 * Signs a JWT with the given PEM private key.
 *
 * - `RS256`: RSA PKCS#1 v1.5 + SHA-256 (Google service accounts).
 * - `ES256`: ECDSA P-256 + SHA-256 (Apple APNs .p8 keys). Signatures are
 *   emitted in the raw R‖S (IEEE P1363) form JWT requires — Node's default
 *   ECDSA output is DER, which is invalid in a JWT.
 */
export function signJwt(options: {
  header: Record<string, string | number>;
  payload: Record<string, unknown>;
  key: string;
  algorithm: JwtAlgorithm;
}): string {
  const { header, payload, key, algorithm } = options;

  if (header.alg !== algorithm) {
    throw new Error("signJwt: header.alg does not match signing algorithm");
  }

  const signingInput = [
    base64url(JSON.stringify(header)),
    base64url(JSON.stringify(payload)),
  ].join(".");

  const privateKey = createPrivateKey(key);
  const signature = createSign("sha256")
    .update(signingInput)
    .end()
    .sign({ key: privateKey, dsaEncoding: "ieee-p1363" });

  return `${signingInput}.${base64url(signature)}`;
}
