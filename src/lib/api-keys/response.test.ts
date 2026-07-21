import { describe, expect, it } from "vitest";

import { apiSuccess, apiError } from "@/lib/api-keys/response";
import { AuthError, NotFoundError, RateLimitError } from "@/lib/errors";

const rateLimit = {
  allowed: true,
  remaining: 42,
  limit: 60,
  resetAt: new Date("2026-07-21T00:01:00.000Z"),
};

describe("apiSuccess", () => {
  it("wraps data and attaches rate-limit headers", async () => {
    const res = apiSuccess({ pools: [] }, rateLimit);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("60");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("42");
    expect(await res.json()).toEqual({ data: { pools: [] } });
  });
});

describe("apiError", () => {
  it("maps AuthError to a 401 with its message", async () => {
    const res = apiError(new AuthError("Invalid or revoked API key."));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "AUTH", message: "Invalid or revoked API key." },
    });
  });

  it("maps NotFoundError to a 404", async () => {
    const res = apiError(new NotFoundError());
    expect(res.status).toBe(404);
  });

  it("maps RateLimitError to a 429 with a Retry-After header", async () => {
    const res = apiError(new RateLimitError());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("maps an unknown error to a generic 500, never leaking its message", async () => {
    const res = apiError(new Error("db connection string leaked here"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).not.toContain("leaked");
    expect(body.error.code).toBe("APP");
  });
});
