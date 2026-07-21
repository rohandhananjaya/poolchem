/**
 * Shared response shaping for `/api/v1` route handlers: consistent error
 * bodies (never leaking a raw stack trace) and rate-limit headers on every
 * response, success or failure.
 */
import { NextResponse } from "next/server";

import { isAppError, toUserMessage } from "@/lib/errors";
import type { RateLimitResult } from "@/lib/db/api-keys";

function rateLimitHeaders(rateLimit: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": rateLimit.resetAt.toISOString(),
  };
}

/** Builds a `{ data }` success response with rate-limit headers attached. */
export function apiSuccess(
  data: unknown,
  rateLimit: RateLimitResult,
): NextResponse {
  return NextResponse.json({ data }, { headers: rateLimitHeaders(rateLimit) });
}

/**
 * Maps a thrown error to a JSON error response. `AppError` subclasses (auth,
 * plan-access, not-found, rate-limit) carry their own safe message/status;
 * anything else becomes a generic 500 so internals never leak to a caller.
 *
 * A 429 is thrown by `authenticateApiKey` before it can return the exact
 * `RateLimitResult`, so `Retry-After` is a fixed 60s (the window size) rather
 * than the precise remaining time — a deliberate simplification, not a bug.
 */
export function apiError(error: unknown): NextResponse {
  const status = isAppError(error) ? error.status : 500;
  const code = isAppError(error) ? error.code : "APP";
  const headers = status === 429 ? { "Retry-After": "60" } : undefined;

  return NextResponse.json(
    { error: { code, message: toUserMessage(error) } },
    { status, headers },
  );
}
