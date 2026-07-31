import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getCompanyId: vi.fn(),
}));
vi.mock("@/lib/db/packages", () => ({
  simulatePayment: vi.fn(),
  startTrial: vi.fn(),
  getCompanyPackage: vi.fn(),
  handlePaymentSuccess: vi.fn(),
  getPackageBySlug: vi.fn(),
  upgradeCompanyPackage: vi.fn(),
  scheduleDowngrade: vi.fn(),
  cancelPendingDowngrade: vi.fn(),
  simulateSwitch: vi.fn(),
  getCheckoutPlanRef: vi.fn(),
  confirmPendingUpgrade: vi.fn(),
}));
vi.mock("@/lib/payment", () => ({
  getActiveProviders: vi.fn(),
  getProvider: vi.fn(),
}));
vi.mock("@/lib/db/payment-settings", () => ({
  getPaymentSettings: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { getCompanyId } = await import("@/lib/auth");
const {
  getCompanyPackage,
  getPackageBySlug,
  upgradeCompanyPackage,
  scheduleDowngrade,
  cancelPendingDowngrade,
  getCheckoutPlanRef,
  confirmPendingUpgrade,
} = await import("@/lib/db/packages");
const { getActiveProviders } = await import("@/lib/payment");
const { getPaymentSettings } = await import("@/lib/db/payment-settings");
const { revalidatePath } = await import("next/cache");
const {
  switchPackageAction,
  cancelScheduledDowngradeAction,
  createPaymentAction,
  confirmPayPalUpgradeAction,
} = await import("./actions");

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.append(key, value);
  }
  return fd;
}

const basicPkg = { id: "pkg-basic", slug: "basic", name: "Basic", price: 1900, features: {} as never, sortOrder: 0 };
const proPkg = { id: "pkg-pro", slug: "pro", name: "Pro", price: 2900, features: {} as never, sortOrder: 1 };

const paidAt = new Date("2026-01-15T00:00:00Z");

function activeCompanyPackage(pkg = basicPkg) {
  return {
    package: pkg,
    status: "ACTIVE" as const,
    trialStart: null,
    trialEnd: null,
    paidAt,
    pendingPackage: null,
    pendingEffectiveAt: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCompanyId).mockResolvedValue("company-1");
});

describe("switchPackageAction", () => {
  it("calls upgradeCompanyPackage when the target plan is more expensive", async () => {
    vi.mocked(getCompanyPackage).mockResolvedValue(activeCompanyPackage(basicPkg));
    vi.mocked(getPackageBySlug).mockResolvedValue(proPkg);
    vi.mocked(upgradeCompanyPackage).mockResolvedValue({
      status: "applied",
      companyPackage: activeCompanyPackage(proPkg),
      prorationAmount: 1000,
    });

    const result = await switchPackageAction({ ok: false }, formData({ package: "pro" }));

    expect(upgradeCompanyPackage).toHaveBeenCalledWith(
      "company-1",
      "pro",
      expect.objectContaining({
        successUrl: expect.stringContaining("paypal_upgrade=1&package=pro"),
        cancelUrl: expect.any(String),
      }),
    );
    expect(scheduleDowngrade).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      companyPackage: activeCompanyPackage(proPkg),
      kind: "upgraded",
      prorationAmount: 1000,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/account/package");
  });

  it("returns a redirectUrl instead of applying anything, when PayPal requires re-approval", async () => {
    vi.mocked(getCompanyPackage).mockResolvedValue(activeCompanyPackage(basicPkg));
    vi.mocked(getPackageBySlug).mockResolvedValue(proPkg);
    vi.mocked(upgradeCompanyPackage).mockResolvedValue({
      status: "requires_approval",
      approvalUrl: "https://paypal.com/approve/xyz",
    });

    const result = await switchPackageAction({ ok: false }, formData({ package: "pro" }));

    expect(result).toEqual({ ok: true, redirectUrl: "https://paypal.com/approve/xyz" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("calls scheduleDowngrade when the target plan is cheaper", async () => {
    vi.mocked(getCompanyPackage).mockResolvedValue(activeCompanyPackage(proPkg));
    vi.mocked(getPackageBySlug).mockResolvedValue(basicPkg);
    const effectiveAt = new Date("2026-02-01T00:00:00Z");
    vi.mocked(scheduleDowngrade).mockResolvedValue({
      companyPackage: activeCompanyPackage(proPkg),
      effectiveAt,
    });

    const result = await switchPackageAction({ ok: false }, formData({ package: "basic" }));

    expect(scheduleDowngrade).toHaveBeenCalledWith("company-1", "basic");
    expect(upgradeCompanyPackage).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      companyPackage: activeCompanyPackage(proPkg),
      kind: "downgrade_scheduled",
      effectiveAt: effectiveAt.toISOString(),
    });
  });

  it("errors when the company has no active plan to switch from", async () => {
    vi.mocked(getCompanyPackage).mockResolvedValue({
      package: null,
      status: "TRIAL",
      trialStart: null,
      trialEnd: null,
      paidAt: null,
      pendingPackage: null,
      pendingEffectiveAt: null,
    });

    const result = await switchPackageAction({ ok: false }, formData({ package: "basic" }));

    expect(result).toEqual({ ok: false, error: "You don't have an active plan to switch from." });
  });

  it("errors when no package is selected", async () => {
    const result = await switchPackageAction({ ok: false }, formData({}));

    expect(result).toEqual({ ok: false, error: "No package selected." });
  });

  it("errors when the target package doesn't exist", async () => {
    vi.mocked(getCompanyPackage).mockResolvedValue(activeCompanyPackage(basicPkg));
    vi.mocked(getPackageBySlug).mockResolvedValue(null);

    const result = await switchPackageAction({ ok: false }, formData({ package: "ghost" }));

    expect(result).toEqual({ ok: false, error: "Package not found." });
  });

  it("errors when the target package is the current plan", async () => {
    vi.mocked(getCompanyPackage).mockResolvedValue(activeCompanyPackage(basicPkg));
    vi.mocked(getPackageBySlug).mockResolvedValue(basicPkg);

    const result = await switchPackageAction({ ok: false }, formData({ package: "basic" }));

    expect(result).toEqual({ ok: false, error: "You're already on this plan." });
  });

  it("surfaces errors thrown by the db layer", async () => {
    vi.mocked(getCompanyPackage).mockResolvedValue(activeCompanyPackage(basicPkg));
    vi.mocked(getPackageBySlug).mockResolvedValue(proPkg);
    vi.mocked(upgradeCompanyPackage).mockRejectedValue(new Error("Stripe is down"));

    const result = await switchPackageAction({ ok: false }, formData({ package: "pro" }));

    expect(result).toEqual({ ok: false, error: "Stripe is down" });
  });
});

describe("confirmPayPalUpgradeAction", () => {
  it("confirms the pending upgrade for the current company", async () => {
    vi.mocked(confirmPendingUpgrade).mockResolvedValue(activeCompanyPackage(proPkg));

    const result = await confirmPayPalUpgradeAction("pro");

    expect(confirmPendingUpgrade).toHaveBeenCalledWith("company-1", "pro");
    expect(result).toEqual({ ok: true, companyPackage: activeCompanyPackage(proPkg), kind: "upgraded" });
  });

  it("surfaces errors thrown by the db layer, e.g. approval not completed yet", async () => {
    vi.mocked(confirmPendingUpgrade).mockRejectedValue(new Error("The plan change hasn't been approved yet."));

    const result = await confirmPayPalUpgradeAction("pro");

    expect(result).toEqual({ ok: false, error: "The plan change hasn't been approved yet." });
  });
});

describe("createPaymentAction", () => {
  it("passes the cached PayPal plan ref into createCheckout so it isn't left to mint a fresh ad-hoc plan", async () => {
    vi.mocked(getPackageBySlug).mockResolvedValue(basicPkg);
    vi.mocked(getPaymentSettings).mockResolvedValue({
      stripeEnabled: false,
      paypalEnabled: true,
      paymentDevMode: true,
    });
    vi.mocked(getCheckoutPlanRef).mockResolvedValue("plan_cached_basic");
    const createCheckout = vi.fn().mockResolvedValue({ url: "https://paypal.com/approve", sessionId: "sub_1" });
    vi.mocked(getActiveProviders).mockResolvedValue([{ name: "paypal", createCheckout } as never]);

    const result = await createPaymentAction({ ok: false }, formData({ package: "basic" }));

    expect(getCheckoutPlanRef).toHaveBeenCalledWith("basic", "paypal", true);
    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ packageSlug: "basic", planRef: "plan_cached_basic" }),
      true,
    );
    expect(result).toEqual({ ok: true, companyPackage: undefined, redirectUrl: "https://paypal.com/approve" });
  });

  it("errors when no package is selected", async () => {
    const result = await createPaymentAction({ ok: false }, formData({}));

    expect(result).toEqual({ ok: false, error: "No package selected." });
  });
});

describe("cancelScheduledDowngradeAction", () => {
  it("cancels the pending downgrade and revalidates", async () => {
    vi.mocked(cancelPendingDowngrade).mockResolvedValue(activeCompanyPackage(proPkg));

    const result = await cancelScheduledDowngradeAction();

    expect(cancelPendingDowngrade).toHaveBeenCalledWith("company-1");
    expect(result).toEqual({ ok: true, companyPackage: activeCompanyPackage(proPkg) });
    expect(revalidatePath).toHaveBeenCalledWith("/account/package");
  });

  it("surfaces errors thrown by the db layer", async () => {
    vi.mocked(cancelPendingDowngrade).mockRejectedValue(new Error("boom"));

    const result = await cancelScheduledDowngradeAction();

    expect(result).toEqual({ ok: false, error: "boom" });
  });
});
