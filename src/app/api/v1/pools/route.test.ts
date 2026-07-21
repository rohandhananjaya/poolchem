import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-keys/auth", () => ({
  authenticateApiKey: vi.fn(),
}));
vi.mock("@/lib/db/pools", () => ({
  getPoolsByCompany: vi.fn(),
}));

const { authenticateApiKey } = await import("@/lib/api-keys/auth");
const { getPoolsByCompany } = await import("@/lib/db/pools");
const { GET } = await import("./route");

import { AuthError, RateLimitError, UnauthorizedError } from "@/lib/errors";

const rateLimit = { allowed: true, remaining: 59, limit: 60, resetAt: new Date() };

function req() {
  return new NextRequest("http://localhost/api/v1/pools");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/v1/pools", () => {
  it("returns 200 with the company's pools", async () => {
    vi.mocked(authenticateApiKey).mockResolvedValue({
      companyId: "company-1",
      apiKey: {} as never,
      rateLimit,
    });
    vi.mocked(getPoolsByCompany).mockResolvedValue([{ id: "pool-1" } as never]);

    const res = await GET(req());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.pools).toHaveLength(1);
    expect(getPoolsByCompany).toHaveBeenCalledWith("company-1");
  });

  it("returns 401 when the API key is invalid", async () => {
    vi.mocked(authenticateApiKey).mockRejectedValue(new AuthError("Invalid or revoked API key."));

    const res = await GET(req());

    expect(res.status).toBe(401);
  });

  it("returns 403 when the plan lacks api_access", async () => {
    vi.mocked(authenticateApiKey).mockRejectedValue(
      new UnauthorizedError("API access is not available on this plan."),
    );

    const res = await GET(req());

    expect(res.status).toBe(403);
  });

  it("returns 429 with Retry-After when rate-limited", async () => {
    vi.mocked(authenticateApiKey).mockRejectedValue(new RateLimitError());

    const res = await GET(req());

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });
});
