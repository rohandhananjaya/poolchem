/**
 * Bearer-token authentication for the `/api/v1` REST API. Deliberately
 * parallel to (not built on) `getCurrentUser()` in `@/lib/auth` — an API key
 * is a distinct, stateless credential, not a Supabase cookie session.
 */
import "server-only";

import type { NextRequest } from "next/server";

import { AuthError, UnauthorizedError, RateLimitError } from "@/lib/errors";
import {
  findActiveApiKeyByHash,
  touchApiKeyLastUsed,
  checkAndIncrementRateLimit,
  type ApiKeySummary,
  type RateLimitResult,
} from "@/lib/db/api-keys";
import { getCompanyPackage } from "@/lib/db/packages";
import { checkFeatureAccess } from "@/lib/package-features";
import { hashApiKeySecret } from "@/lib/api-keys/keys";

/** Requests per minute allowed for a single API key (v1: one flat tier). */
export const API_RATE_LIMIT_PER_MINUTE = 60;

export interface ApiKeyAuthResult {
  companyId: string;
  apiKey: ApiKeySummary;
  rateLimit: RateLimitResult;
}

/**
 * Authenticates a request via its `Authorization: Bearer <key>` header.
 *
 * @throws {AuthError} Missing/malformed header, unknown/revoked key, or a
 *   suspended company — all indistinguishable to the caller (401).
 * @throws {UnauthorizedError} The company's current plan doesn't include
 *   `api_access` — checked live on every request, not cached, so a downgrade
 *   takes effect immediately (403).
 * @throws {RateLimitError} The key has exceeded its per-minute quota (429).
 */
export async function authenticateApiKey(
  request: NextRequest,
): Promise<ApiKeyAuthResult> {
  const header = request.headers.get("authorization");
  const secret = header?.match(/^Bearer\s+(.+)$/)?.[1];
  if (!secret) {
    throw new AuthError("Missing or malformed Authorization header.");
  }

  const record = await findActiveApiKeyByHash(hashApiKeySecret(secret));
  if (!record) {
    throw new AuthError("Invalid or revoked API key.");
  }

  if (!record.company.active) {
    throw new AuthError("This company's account is suspended.");
  }

  const companyPackage = await getCompanyPackage(record.companyId);
  if (!companyPackage || !checkFeatureAccess(companyPackage, "api_access")) {
    throw new UnauthorizedError("API access is not available on this plan.");
  }

  const rateLimit = await checkAndIncrementRateLimit(
    record.id,
    API_RATE_LIMIT_PER_MINUTE,
  );
  if (!rateLimit.allowed) {
    throw new RateLimitError();
  }

  await touchApiKeyLastUsed(record.id);

  return {
    companyId: record.companyId,
    apiKey: {
      id: record.id,
      name: record.name,
      keyPrefix: record.keyPrefix,
      lastUsedAt: record.lastUsedAt,
      revokedAt: record.revokedAt,
      createdAt: record.createdAt,
    },
    rateLimit,
  };
}
