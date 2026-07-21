import { describe, expect, it } from "vitest";

import { generateApiKeySecret, hashApiKeySecret } from "@/lib/api-keys/keys";

describe("generateApiKeySecret", () => {
  it("returns a secret with the expected prefix", () => {
    const { secret } = generateApiKeySecret();
    expect(secret).toMatch(/^pb_live_/);
  });

  it("returns a displayPrefix that is a prefix of the secret", () => {
    const { secret, displayPrefix } = generateApiKeySecret();
    expect(secret.startsWith(displayPrefix)).toBe(true);
    expect(displayPrefix.length).toBeLessThan(secret.length);
  });

  it("generates a different secret on every call", () => {
    const a = generateApiKeySecret();
    const b = generateApiKeySecret();
    expect(a.secret).not.toBe(b.secret);
  });
});

describe("hashApiKeySecret", () => {
  it("is deterministic for the same input", () => {
    const { secret } = generateApiKeySecret();
    expect(hashApiKeySecret(secret)).toBe(hashApiKeySecret(secret));
  });

  it("produces different hashes for different secrets", () => {
    const a = generateApiKeySecret();
    const b = generateApiKeySecret();
    expect(hashApiKeySecret(a.secret)).not.toBe(hashApiKeySecret(b.secret));
  });

  it("returns a 64-char lowercase hex string (sha256)", () => {
    const { secret } = generateApiKeySecret();
    expect(hashApiKeySecret(secret)).toMatch(/^[0-9a-f]{64}$/);
  });
});
