import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/api-keys", () => ({
  findActiveApiKeyByHash: vi.fn(),
  touchApiKeyLastUsed: vi.fn(),
  checkAndIncrementRateLimit: vi.fn(),
}));
vi.mock("@/lib/db/packages", () => ({
  getCompanyPackage: vi.fn(),
}));

const {
  findActiveApiKeyByHash,
  touchApiKeyLastUsed,
  checkAndIncrementRateLimit,
} = await import("@/lib/db/api-keys");
const { getCompanyPackage } = await import("@/lib/db/packages");
const { authenticateApiKey } = await import("@/lib/api-keys/auth");

function requestWithAuth(header: string | null) {
  return {
    headers: { get: (name: string) => (name === "authorization" ? header : null) },
  } as never;
}

const activeCompanyPackage = {
  package: null,
  status: "TRIAL",
  trialStart: new Date(),
  trialEnd: null,
  paidAt: null,
};

const noAccessCompanyPackage = {
  package: {
    id: "pkg-1",
    slug: "basic",
    name: "Basic",
    price: 0,
    sortOrder: 0,
    features: { api_access: false } as never,
  },
  status: "ACTIVE",
  trialStart: null,
  trialEnd: null,
  paidAt: new Date(),
};

const mockKeyRecord = {
  id: "key-1",
  companyId: "company-1",
  name: "Zapier integration",
  keyPrefix: "pb_live_ab12cd",
  keyHash: "hash-abc",
  lastUsedAt: null,
  revokedAt: null,
  createdAt: new Date(),
  company: { id: "company-1", active: true },
};

const allowedRateLimit = {
  allowed: true,
  remaining: 59,
  limit: 60,
  resetAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("authenticateApiKey", () => {
  it("throws AuthError when the Authorization header is missing", async () => {
    await expect(authenticateApiKey(requestWithAuth(null))).rejects.toThrow(
      /authorization/i,
    );
  });

  it("throws AuthError when the header is not a Bearer token", async () => {
    await expect(
      authenticateApiKey(requestWithAuth("Basic abc123")),
    ).rejects.toThrow(/authorization/i);
  });

  it("throws AuthError when the key is unknown or revoked", async () => {
    vi.mocked(findActiveApiKeyByHash).mockResolvedValue(null);

    await expect(
      authenticateApiKey(requestWithAuth("Bearer pb_live_bad")),
    ).rejects.toThrow(/invalid or revoked/i);
  });

  it("throws AuthError when the company is suspended", async () => {
    vi.mocked(findActiveApiKeyByHash).mockResolvedValue({
      ...mockKeyRecord,
      company: { id: "company-1", active: false },
    } as never);

    await expect(
      authenticateApiKey(requestWithAuth("Bearer pb_live_ok")),
    ).rejects.toThrow(/suspended/i);
  });

  it("throws UnauthorizedError when the plan lacks api_access", async () => {
    vi.mocked(findActiveApiKeyByHash).mockResolvedValue(mockKeyRecord as never);
    vi.mocked(getCompanyPackage).mockResolvedValue(noAccessCompanyPackage as never);

    await expect(
      authenticateApiKey(requestWithAuth("Bearer pb_live_ok")),
    ).rejects.toThrow(/not available on this plan/i);
  });

  it("throws RateLimitError when the key has exceeded its quota", async () => {
    vi.mocked(findActiveApiKeyByHash).mockResolvedValue(mockKeyRecord as never);
    vi.mocked(getCompanyPackage).mockResolvedValue(activeCompanyPackage as never);
    vi.mocked(checkAndIncrementRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      limit: 60,
      resetAt: new Date(),
    });

    await expect(
      authenticateApiKey(requestWithAuth("Bearer pb_live_ok")),
    ).rejects.toThrow(/too many requests/i);
    expect(touchApiKeyLastUsed).not.toHaveBeenCalled();
  });

  it("succeeds and touches lastUsedAt for a valid, in-quota request", async () => {
    vi.mocked(findActiveApiKeyByHash).mockResolvedValue(mockKeyRecord as never);
    vi.mocked(getCompanyPackage).mockResolvedValue(activeCompanyPackage as never);
    vi.mocked(checkAndIncrementRateLimit).mockResolvedValue(allowedRateLimit);

    const result = await authenticateApiKey(requestWithAuth("Bearer pb_live_ok"));

    expect(result.companyId).toBe("company-1");
    expect(result.apiKey.id).toBe("key-1");
    expect(result.rateLimit).toEqual(allowedRateLimit);
    expect(touchApiKeyLastUsed).toHaveBeenCalledWith("key-1");
  });
});
