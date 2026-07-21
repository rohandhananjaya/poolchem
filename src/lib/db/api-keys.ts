/**
 * Data access for {@link ApiKey} records — credentials for the `/api/v1` REST
 * API — and their per-minute rate-limit counters ({@link ApiKeyUsage}).
 *
 * {@link findActiveApiKeyByHash} is intentionally unscoped: it's how a
 * request's company is discovered from the secret itself, the same
 * "unguessable token is the access grant" shape as `getPoolByPublicToken` in
 * `pools.ts`.
 */
import "server-only";

import type { ApiKey, Company } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { generateApiKeySecret, hashApiKeySecret } from "@/lib/api-keys/keys";

/** An API key's fields safe to show in the UI — never includes `keyHash`. */
export interface ApiKeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

function toSummary(key: ApiKey): ApiKeySummary {
  return {
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    lastUsedAt: key.lastUsedAt,
    revokedAt: key.revokedAt,
    createdAt: key.createdAt,
  };
}

/** Returns all API keys (active and revoked) for a company, newest first. */
export async function getApiKeysByCompany(
  companyId: string,
): Promise<ApiKeySummary[]> {
  const keys = await prisma.apiKey.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });
  return keys.map(toSummary);
}

/**
 * Generates and persists a new API key for `companyId`. Returns the plaintext
 * secret alongside its summary — the ONLY time the secret is ever available;
 * only its hash is stored, so it can never be shown again after this call.
 */
export async function createApiKey(
  companyId: string,
  name: string,
): Promise<{ key: ApiKeySummary; plaintextSecret: string }> {
  const { secret, displayPrefix } = generateApiKeySecret();
  const key = await prisma.apiKey.create({
    data: {
      companyId,
      name,
      keyPrefix: displayPrefix,
      keyHash: hashApiKeySecret(secret),
    },
  });
  return { key: toSummary(key), plaintextSecret: secret };
}

/**
 * Revokes an API key, but only if it belongs to `companyId` and isn't already
 * revoked.
 *
 * @throws {NotFoundError} If no matching, still-active key is found.
 */
export async function revokeApiKey(
  keyId: string,
  companyId: string,
): Promise<void> {
  const { count } = await prisma.apiKey.updateMany({
    where: { id: keyId, companyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (count === 0) {
    throw new NotFoundError(`API key "${keyId}" not found for this company.`);
  }
}

/**
 * Looks up a still-active (non-revoked) API key by the sha256 hash of its
 * secret, eager-loading the owning company. NOT company-scoped — this is how
 * the company is discovered from the secret itself, powering `/api/v1` bearer
 * auth. Returns `null` for an unknown or revoked hash.
 */
export async function findActiveApiKeyByHash(
  keyHash: string,
): Promise<(ApiKey & { company: Company }) | null> {
  return prisma.apiKey.findFirst({
    where: { keyHash, revokedAt: null },
    include: { company: true },
  });
}

/** Records that a key was just used, for display in the API-keys UI. */
export async function touchApiKeyLastUsed(keyId: string): Promise<void> {
  await prisma.apiKey.update({
    where: { id: keyId },
    data: { lastUsedAt: new Date() },
  });
}

/** Truncates a date down to the start of its minute (UTC). */
function toMinuteWindow(date: Date): Date {
  const truncated = new Date(date);
  truncated.setUTCSeconds(0, 0);
  return truncated;
}

/** How much older than "now" a usage row can be before it's swept. */
const USAGE_RETENTION_MS = 60 * 60 * 1000; // 1 hour

/** Result of a rate-limit check, ready to become response headers. */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
}

/**
 * Increments (creating if needed) the request counter for `apiKeyId` in the
 * current 1-minute window, and reports whether this request is within
 * `limitPerMinute`.
 *
 * There's no job scheduler in this app to run a proper cleanup cron, so old
 * `ApiKeyUsage` rows are swept opportunistically (~1-in-50 calls) instead of
 * growing the table unbounded.
 */
export async function checkAndIncrementRateLimit(
  apiKeyId: string,
  limitPerMinute: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = toMinuteWindow(now);
  const resetAt = new Date(windowStart.getTime() + 60_000);

  const usage = await prisma.apiKeyUsage.upsert({
    where: { apiKeyId_windowStart: { apiKeyId, windowStart } },
    create: { apiKeyId, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });

  if (Math.random() < 0.02) {
    await prisma.apiKeyUsage.deleteMany({
      where: { windowStart: { lt: new Date(now.getTime() - USAGE_RETENTION_MS) } },
    });
  }

  return {
    allowed: usage.count <= limitPerMinute,
    remaining: Math.max(0, limitPerMinute - usage.count),
    limit: limitPerMinute,
    resetAt,
  };
}
