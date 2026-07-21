import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-keys/auth", () => ({
  authenticateApiKey: vi.fn(),
}));
vi.mock("@/lib/db/pools", () => ({
  getPoolById: vi.fn(),
}));

const { authenticateApiKey } = await import("@/lib/api-keys/auth");
const { getPoolById } = await import("@/lib/db/pools");
const { GET } = await import("./route");

const rateLimit = { allowed: true, remaining: 59, limit: 60, resetAt: new Date() };

function req() {
  return new NextRequest("http://localhost/api/v1/pools/pool-1");
}

function ctx(poolId: string) {
  return { params: Promise.resolve({ poolId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authenticateApiKey).mockResolvedValue({
    companyId: "company-1",
    apiKey: {} as never,
    rateLimit,
  });
});

describe("GET /api/v1/pools/[poolId]", () => {
  it("returns 200 with the pool when it belongs to the company", async () => {
    vi.mocked(getPoolById).mockResolvedValue({ id: "pool-1" } as never);

    const res = await GET(req(), ctx("pool-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.pool.id).toBe("pool-1");
    expect(getPoolById).toHaveBeenCalledWith("pool-1", "company-1");
  });

  it("returns 404 when the pool doesn't exist or belongs to another company", async () => {
    vi.mocked(getPoolById).mockResolvedValue(null);

    const res = await GET(req(), ctx("pool-1"));

    expect(res.status).toBe(404);
  });
});
