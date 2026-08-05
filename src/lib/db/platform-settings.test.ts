import { describe, expect, it, beforeEach, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const {
  getPlatformSettings,
  updateFeeBasedBilling,
  updateLegacyPerPoolRate,
} = await import("@/lib/db/platform-settings");

const now = new Date("2026-01-15T00:00:00Z");

function makeSettings(overrides: Record<string, unknown> = {}) {
  return {
    id: "singleton",
    trialDays: 30,
    stripeEnabled: true,
    paypalEnabled: true,
    paymentDevMode: true,
    feeBasedBilling: false,
    legacyPerPoolRate: 0,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.platformSettings.upsert.mockResolvedValue(makeSettings());
});

describe("getPlatformSettings", () => {
  it("surfaces the feeBasedBilling flag", async () => {
    prismaMock.platformSettings.upsert.mockResolvedValue(
      makeSettings({ feeBasedBilling: true }),
    );

    const settings = await getPlatformSettings();

    expect(settings.feeBasedBilling).toBe(true);
    expect(prismaMock.platformSettings.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });
  });

  it("surfaces the legacyPerPoolRate", async () => {
    prismaMock.platformSettings.upsert.mockResolvedValue(
      makeSettings({ legacyPerPoolRate: 2500 }),
    );

    const settings = await getPlatformSettings();

    expect(settings.legacyPerPoolRate).toBe(2500);
  });
});

describe("updateLegacyPerPoolRate", () => {
  it("persists a rounded cents value", async () => {
    prismaMock.platformSettings.upsert.mockResolvedValue(
      makeSettings({ legacyPerPoolRate: 2500 }),
    );

    const settings = await updateLegacyPerPoolRate(2500.4);

    expect(prismaMock.platformSettings.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      update: { legacyPerPoolRate: 2500 },
      create: { id: "singleton", legacyPerPoolRate: 2500 },
    });
    expect(settings.legacyPerPoolRate).toBe(2500);
  });

  it("throws on a negative rate", async () => {
    await expect(updateLegacyPerPoolRate(-1)).rejects.toThrow(
      /non-negative/,
    );
    expect(prismaMock.platformSettings.upsert).not.toHaveBeenCalled();
  });
});

describe("updateFeeBasedBilling", () => {
  it("persists the flag and persists the toggle off without touching companies", async () => {
    prismaMock.platformSettings.upsert.mockResolvedValue(makeSettings({ feeBasedBilling: false }));

    await updateFeeBasedBilling(false);

    expect(prismaMock.companyPackage.updateMany).not.toHaveBeenCalled();
  });

  it("migrates every trial/active company to FEE_BASED when enabled", async () => {
    prismaMock.platformSettings.upsert.mockResolvedValue(makeSettings({ feeBasedBilling: true }));

    await updateFeeBasedBilling(true);

    expect(prismaMock.companyPackage.updateMany).toHaveBeenCalledWith({
      where: { status: { in: ["TRIAL", "ACTIVE", "EXPIRED", "CANCELLED"] } },
      data: {
        status: "FEE_BASED",
        packageId: null,
        trialStart: null,
        trialEnd: null,
        paidAt: null,
        pendingPackageId: null,
        pendingEffectiveAt: null,
      },
    });
  });
});