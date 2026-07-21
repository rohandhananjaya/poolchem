/**
 * Pure API-key secret generation/hashing. No Prisma import, no I/O — the same
 * "pure domain logic" shape as {@link "@/lib/csv/pool-csv"}, kept separate so
 * generation and hashing can be unit-tested without mocking anything.
 */
import { randomBytes, createHash } from "node:crypto";

/** Prefix on every generated secret, so a leaked value is recognizable as ours. */
const SECRET_PREFIX = "pb_live_";

/** How many characters of the raw secret (after the prefix) are kept for display. */
const DISPLAY_PREFIX_LENGTH = 12;

export interface GeneratedApiKey {
  /** The full secret — shown to the caller exactly once, never persisted. */
  secret: string;
  /** First `DISPLAY_PREFIX_LENGTH` chars after the prefix, safe to store/display. */
  displayPrefix: string;
}

/** Generates a new API key secret with 192 bits of entropy. */
export function generateApiKeySecret(): GeneratedApiKey {
  const random = randomBytes(24).toString("base64url");
  const secret = `${SECRET_PREFIX}${random}`;
  return {
    secret,
    displayPrefix: `${SECRET_PREFIX}${random.slice(0, DISPLAY_PREFIX_LENGTH)}`,
  };
}

/** Deterministic sha256 hash of a secret, used as the DB lookup key. */
export function hashApiKeySecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}
