import { describe, expect, it } from "vitest";
import {
  generateKeyPairSync,
  verify,
  type KeyObject,
} from "node:crypto";

import { signJwt } from "./jwt";

function rs256Keys(): { privateKey: string; publicKey: KeyObject } {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  return {
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
    publicKey,
  };
}

function es256Keys(): { privateKey: string; publicKey: KeyObject } {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  return {
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
    publicKey,
  };
}

describe("signJwt", () => {
  it("rejects a header alg that contradicts the signing algorithm", () => {
    const { privateKey } = es256Keys();

    expect(() =>
      signJwt({
        header: { alg: "RS256", kid: "k1" },
        payload: { iss: "team" },
        key: privateKey,
        algorithm: "ES256",
      }),
    ).toThrow("header.alg does not match signing algorithm");
  });

  it("signs an RS256 token that verifies with the public key", () => {
    const { privateKey, publicKey } = rs256Keys();

    const token = signJwt({
      header: { alg: "RS256", typ: "JWT" },
      payload: { iss: "service-account@x.iam.gserviceaccount.com", scope: "s" },
      key: privateKey,
      algorithm: "RS256",
    });

    const [header, payload, signature] = token.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({
      alg: "RS256",
      typ: "JWT",
    });
    expect(
      JSON.parse(Buffer.from(payload, "base64url").toString()),
    ).toMatchObject({ iss: "service-account@x.iam.gserviceaccount.com" });

    const verified = verify(
      "sha256",
      Buffer.from(`${header}.${payload}`),
      publicKey,
      Buffer.from(signature, "base64url"),
    );
    expect(verified).toBe(true);
  });

  it("signs an ES256 token with a raw R||S signature (JWT form)", () => {
    const { privateKey, publicKey } = es256Keys();

    const token = signJwt({
      header: { alg: "ES256", kid: "key-1" },
      payload: { iss: "team", iat: 1 },
      key: privateKey,
      algorithm: "ES256",
    });

    const [header, payload, signature] = token.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({
      alg: "ES256",
      kid: "key-1",
    });

    const signatureBytes = Buffer.from(signature, "base64url");
    // JWT requires raw R||S (64 bytes for P-256), not DER (which starts 0x30).
    expect(signatureBytes.length).toBe(64);
    expect(signatureBytes[0]).not.toBe(0x30);

    const verified = verify(
      "sha256",
      Buffer.from(`${header}.${payload}`),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      signatureBytes,
    );
    expect(verified).toBe(true);
  });
});
