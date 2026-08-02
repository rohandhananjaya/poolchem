import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireOwner: vi.fn(),
}));
vi.mock("@/lib/db/api-keys", () => ({
  createApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
}));
vi.mock("@/lib/db/packages", () => ({
  getCompanyPackage: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({
  audit: { log: vi.fn() },
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/api-keys/postman-collection", () => ({
  buildPostmanCollection: vi.fn(),
}));

const { requireOwner } = await import("@/lib/auth");
const { createApiKey, revokeApiKey } = await import("@/lib/db/api-keys");
const { getCompanyPackage } = await import("@/lib/db/packages");
const { audit } = await import("@/lib/audit");
const { revalidatePath } = await import("next/cache");
const { buildPostmanCollection } = await import("@/lib/api-keys/postman-collection");
const {
  createApiKeyAction,
  revokeApiKeyAction,
  downloadPostmanCollectionAction,
} = await import("./actions");

const mockUser = { id: "user-1", companyId: "company-1", role: "OWNER" };

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createApiKeyAction", () => {
  it("creates a key and returns the plaintext secret once", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
    vi.mocked(getCompanyPackage).mockResolvedValue(activeCompanyPackage as never);
    vi.mocked(createApiKey).mockResolvedValue({
      key: { id: "key-1", name: "Zapier", keyPrefix: "pb_live_ab", lastUsedAt: null, revokedAt: null, createdAt: new Date() },
      plaintextSecret: "pb_live_abcdef",
    });

    const result = await createApiKeyAction("Zapier");

    expect(result.ok).toBe(true);
    expect(result.plaintextSecret).toBe("pb_live_abcdef");
    expect(createApiKey).toHaveBeenCalledWith("company-1", "Zapier");
    expect(audit.log).toHaveBeenCalledWith(
      "company-1",
      "user-1",
      "api_key.created",
      expect.objectContaining({ name: "Zapier" }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/account/api-keys");
  });

  it("rejects an empty name", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);

    const result = await createApiKeyAction("   ");

    expect(result).toEqual({ ok: false, error: "A name is required to tell keys apart." });
    expect(createApiKey).not.toHaveBeenCalled();
  });

  it("blocks creation when the plan lacks api_access", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
    vi.mocked(getCompanyPackage).mockResolvedValue(noAccessCompanyPackage as never);

    const result = await createApiKeyAction("Zapier");

    expect(result).toEqual({
      ok: false,
      error: "API access is not available on your plan.",
    });
    expect(createApiKey).not.toHaveBeenCalled();
  });

  it("returns an error when the user has no company", async () => {
    vi.mocked(requireOwner).mockResolvedValue({ ...mockUser, companyId: null } as never);

    const result = await createApiKeyAction("Zapier");

    expect(result).toEqual({ ok: false, error: "No company affiliation." });
  });
});

describe("revokeApiKeyAction", () => {
  it("revokes a key belonging to the caller's company", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
    vi.mocked(revokeApiKey).mockResolvedValue(undefined);

    const result = await revokeApiKeyAction("key-1");

    expect(result).toEqual({ ok: true });
    expect(revokeApiKey).toHaveBeenCalledWith("key-1", "company-1");
    expect(audit.log).toHaveBeenCalledWith("company-1", "user-1", "api_key.revoked", { keyId: "key-1" });
    expect(revalidatePath).toHaveBeenCalledWith("/account/api-keys");
  });

  it("returns an error when the key belongs to another company (NotFoundError)", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
    vi.mocked(revokeApiKey).mockRejectedValue(new Error("not found"));

    const result = await revokeApiKeyAction("key-1");

    expect(result).toEqual({
      ok: false,
      error: "Could not revoke the API key. Please try again.",
    });
  });
});

describe("downloadPostmanCollectionAction", () => {
  it("builds a collection rooted at the configured app URL", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
    vi.mocked(getCompanyPackage).mockResolvedValue(activeCompanyPackage as never);
    vi.mocked(buildPostmanCollection).mockReturnValue("{}");
    process.env.NEXT_PUBLIC_APP_URL = "https://poolbench.com";

    const result = await downloadPostmanCollectionAction();

    expect(result).toEqual({ ok: true, collection: "{}" });
    expect(buildPostmanCollection).toHaveBeenCalledWith("https://poolbench.com");
  });

  it("falls back to the local origin when NEXT_PUBLIC_APP_URL is unset", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
    vi.mocked(getCompanyPackage).mockResolvedValue(activeCompanyPackage as never);
    vi.mocked(buildPostmanCollection).mockReturnValue("{}");
    delete process.env.NEXT_PUBLIC_APP_URL;

    const result = await downloadPostmanCollectionAction();

    expect(result.ok).toBe(true);
    expect(buildPostmanCollection).toHaveBeenCalledWith("https://localhost:3000");
  });

  it("blocks download when the plan lacks api_access", async () => {
    vi.mocked(requireOwner).mockResolvedValue(mockUser as never);
    vi.mocked(getCompanyPackage).mockResolvedValue(noAccessCompanyPackage as never);

    const result = await downloadPostmanCollectionAction();

    expect(result).toEqual({
      ok: false,
      error: "API access is not available on your plan.",
    });
    expect(buildPostmanCollection).not.toHaveBeenCalled();
  });

  it("returns an error when the user has no company", async () => {
    vi.mocked(requireOwner).mockResolvedValue({ ...mockUser, companyId: null } as never);

    const result = await downloadPostmanCollectionAction();

    expect(result).toEqual({ ok: false, error: "No company affiliation." });
    expect(buildPostmanCollection).not.toHaveBeenCalled();
  });
});
