import { describe, expect, it, beforeEach, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const {
  getApiKeysByCompany,
  createApiKey,
  revokeApiKey,
  findActiveApiKeyByHash,
  touchApiKeyLastUsed,
  checkAndIncrementRateLimit,
} = await import("@/lib/db/api-keys");

const companyId = "company-1";
const keyId = "key-1";

const mockKey = {
  id: keyId,
  companyId,
  name: "Zapier integration",
  keyPrefix: "pb_live_ab12cd",
  keyHash: "hash-abc",
  lastUsedAt: null,
  revokedAt: null,
  createdAt: new Date("2026-07-01"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getApiKeysByCompany", () => {
  it("returns keys without keyHash", async () => {
    prismaMock.apiKey.findMany.mockResolvedValue([mockKey]);

    const result = await getApiKeysByCompany(companyId);

    expect(prismaMock.apiKey.findMany).toHaveBeenCalledWith({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty("keyHash");
    expect(result[0].id).toBe(keyId);
  });

  it("returns an empty array when the company has no keys", async () => {
    prismaMock.apiKey.findMany.mockResolvedValue([]);
    expect(await getApiKeysByCompany(companyId)).toEqual([]);
  });
});

describe("createApiKey", () => {
  it("persists a hash and prefix, and returns the plaintext secret once", async () => {
    prismaMock.apiKey.create.mockResolvedValue(mockKey);

    const result = await createApiKey(companyId, "Zapier integration");

    expect(prismaMock.apiKey.create).toHaveBeenCalledWith({
      data: {
        companyId,
        name: "Zapier integration",
        keyPrefix: expect.stringMatching(/^pb_live_/),
        keyHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
    });
    expect(result.plaintextSecret).toMatch(/^pb_live_/);
    expect(result.key).not.toHaveProperty("keyHash");
  });
});

describe("revokeApiKey", () => {
  it("revokes when the key belongs to the company and is active", async () => {
    prismaMock.apiKey.updateMany.mockResolvedValue({ count: 1 });

    await revokeApiKey(keyId, companyId);

    expect(prismaMock.apiKey.updateMany).toHaveBeenCalledWith({
      where: { id: keyId, companyId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("throws NotFoundError when the key belongs to another company", async () => {
    prismaMock.apiKey.updateMany.mockResolvedValue({ count: 0 });

    await expect(revokeApiKey(keyId, "wrong-company")).rejects.toThrow(
      /not found/i,
    );
  });

  it("throws NotFoundError when the key is already revoked", async () => {
    prismaMock.apiKey.updateMany.mockResolvedValue({ count: 0 });

    await expect(revokeApiKey(keyId, companyId)).rejects.toThrow(/not found/i);
  });
});

describe("findActiveApiKeyByHash", () => {
  it("returns the key with its company when active", async () => {
    const withCompany = { ...mockKey, company: { id: companyId, name: "Test Co" } };
    prismaMock.apiKey.findFirst.mockResolvedValue(withCompany);

    const result = await findActiveApiKeyByHash("hash-abc");

    expect(prismaMock.apiKey.findFirst).toHaveBeenCalledWith({
      where: { keyHash: "hash-abc", revokedAt: null },
      include: { company: true },
    });
    expect(result).toEqual(withCompany);
  });

  it("returns null for an unknown or revoked hash", async () => {
    prismaMock.apiKey.findFirst.mockResolvedValue(null);
    expect(await findActiveApiKeyByHash("nope")).toBeNull();
  });
});

describe("touchApiKeyLastUsed", () => {
  it("updates lastUsedAt", async () => {
    prismaMock.apiKey.update.mockResolvedValue(mockKey);

    await touchApiKeyLastUsed(keyId);

    expect(prismaMock.apiKey.update).toHaveBeenCalledWith({
      where: { id: keyId },
      data: { lastUsedAt: expect.any(Date) },
    });
  });
});

describe("checkAndIncrementRateLimit", () => {
  it("allows the request when under the limit", async () => {
    prismaMock.apiKeyUsage.upsert.mockResolvedValue({
      id: "usage-1",
      apiKeyId: keyId,
      windowStart: new Date(),
      count: 5,
    });

    const result = await checkAndIncrementRateLimit(keyId, 60);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(55);
    expect(result.limit).toBe(60);
  });

  it("disallows the request once the count exceeds the limit", async () => {
    prismaMock.apiKeyUsage.upsert.mockResolvedValue({
      id: "usage-1",
      apiKeyId: keyId,
      windowStart: new Date(),
      count: 61,
    });

    const result = await checkAndIncrementRateLimit(keyId, 60);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("upserts on the apiKeyId + truncated-minute window", async () => {
    prismaMock.apiKeyUsage.upsert.mockResolvedValue({
      id: "usage-1",
      apiKeyId: keyId,
      windowStart: new Date(),
      count: 1,
    });

    await checkAndIncrementRateLimit(keyId, 60);

    expect(prismaMock.apiKeyUsage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          apiKeyId_windowStart: {
            apiKeyId: keyId,
            windowStart: expect.any(Date),
          },
        },
        create: { apiKeyId: keyId, windowStart: expect.any(Date), count: 1 },
        update: { count: { increment: 1 } },
      }),
    );
  });
});
