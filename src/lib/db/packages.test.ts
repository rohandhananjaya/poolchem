import { describe, expect, it, beforeEach, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const mockLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
vi.mock("@/lib/log", () => ({ logger: mockLogger }));

const mockGetProvider = vi.fn();
vi.mock("@/lib/payment", () => ({ getProvider: mockGetProvider }));

const mockNotify = {
  notifyTrialExpired: vi.fn(),
  notifyTrialExpiring: vi.fn(),
};
vi.mock("@/lib/email/notify", () => mockNotify);

const {
  upgradeCompanyPackage,
  scheduleDowngrade,
  cancelPendingDowngrade,
  getCompanyPackage,
  handlePaymentSuccess,
  handleSubscriptionCancelled,
  countCompaniesOnPackage,
  getCheckoutPlanRef,
  confirmPendingUpgrade,
  handlePlanRevisionConfirmed,
  expireTrial,
  checkAndExpireTrials,
} = await import("@/lib/db/packages");

const now = new Date("2026-01-15T00:00:00Z");
const past = new Date("2026-01-01T00:00:00Z");
const future = new Date("2026-02-01T00:00:00Z");

function makePackage(overrides: Record<string, unknown> = {}) {
  return {
    id: "pkg-basic",
    slug: "basic",
    name: "Basic",
    price: 1900,
    features: JSON.stringify({ max_pools: 10 }),
    sortOrder: 0,
    stripePriceId: null,
    paypalPlanId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeCompany(overrides: Record<string, unknown> = {}) {
  return {
    id: "company-1",
    name: "Test Co",
    logo: null,
    email: "test@co.com",
    phone: null,
    address: null,
    active: true,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: null,
    paypalSubscriptionId: null,
    paypalPlanId: null,
    fromEmail: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeCompanyPackage(overrides: Record<string, unknown> = {}) {
  return {
    id: "cp-1",
    companyId: "company-1",
    packageId: "pkg-basic",
    status: "ACTIVE",
    trialStart: null,
    trialEnd: null,
    paidAt: now,
    pendingPackageId: null,
    pendingEffectiveAt: null,
    createdAt: now,
    updatedAt: now,
    package: makePackage(),
    pendingPackage: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.platformSettings.upsert.mockResolvedValue({
    id: "singleton",
    trialDays: 30,
    stripeEnabled: true,
    paypalEnabled: true,
    paymentDevMode: true,
    updatedAt: now,
  });
});

describe("upgradeCompanyPackage", () => {
  it("revises the existing subscription with isUpgrade: true and activates the target plan", async () => {
    const company = makeCompany({ stripeSubscriptionId: "sub_123" });
    const targetPkg = makePackage({
      id: "pkg-pro",
      slug: "pro",
      price: 2900,
      stripePriceId: "price_pro",
    });
    const reviseSubscription = vi.fn().mockResolvedValue({ status: "applied", prorationAmount: 1000 });
    mockGetProvider.mockResolvedValue({ reviseSubscription });

    prismaMock.company.findUnique.mockResolvedValue(company);
    prismaMock.package.findUnique.mockResolvedValue(targetPkg);
    prismaMock.$transaction.mockResolvedValue([
      makeCompanyPackage({ packageId: "pkg-pro", package: targetPkg }),
    ]);

    const result = await upgradeCompanyPackage("company-1", "pro");

    expect(mockGetProvider).toHaveBeenCalledWith("stripe");
    expect(reviseSubscription).toHaveBeenCalledWith(
      { subscriptionId: "sub_123", newPlanRef: "price_pro", isUpgrade: true },
      true,
    );
    expect(result).toMatchObject({ status: "applied", prorationAmount: 1000 });
    expect(prismaMock.package.update).not.toHaveBeenCalled(); // already cached, no need to create

    expect(prismaMock.companyPackage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: "company-1" },
        data: expect.objectContaining({
          packageId: "pkg-pro",
          status: "ACTIVE",
          pendingPackageId: null,
          pendingEffectiveAt: null,
        }),
      }),
    );
  });

  it("creates and caches a plan ref when the package has none yet", async () => {
    const company = makeCompany({ paypalSubscriptionId: "sub_paypal_1" });
    const targetPkg = makePackage({ id: "pkg-pro", slug: "pro", name: "Pro", price: 2900, paypalPlanId: null });
    const reviseSubscription = vi.fn().mockResolvedValue({ status: "applied" });
    const createPlanRef = vi.fn().mockResolvedValue("plan_ref_abc");
    mockGetProvider.mockResolvedValue({ reviseSubscription, createPlanRef });

    prismaMock.company.findUnique.mockResolvedValue(company);
    prismaMock.package.findUnique.mockResolvedValue(targetPkg);
    prismaMock.package.update.mockResolvedValue({ ...targetPkg, paypalPlanId: "plan_ref_abc" });
    prismaMock.$transaction.mockResolvedValue([makeCompanyPackage({ packageId: "pkg-pro" })]);

    await upgradeCompanyPackage("company-1", "pro");

    expect(createPlanRef).toHaveBeenCalledWith(
      { slug: "pro", name: "Pro", price: 2900 },
      true,
    );
    expect(prismaMock.package.update).toHaveBeenCalledWith({
      where: { id: "pkg-pro" },
      data: { paypalPlanId: "plan_ref_abc" },
    });
    expect(reviseSubscription).toHaveBeenCalledWith(
      { subscriptionId: "sub_paypal_1", newPlanRef: "plan_ref_abc", isUpgrade: true },
      true,
    );
  });

  it("throws when the company has no active subscription", async () => {
    prismaMock.company.findUnique.mockResolvedValue(makeCompany());

    await expect(upgradeCompanyPackage("company-1", "pro")).rejects.toThrow(
      /no active subscription/i,
    );
  });

  it("returns requires_approval with the approval url instead of writing any DB state, when PayPal demands re-approval", async () => {
    const company = makeCompany({ paypalSubscriptionId: "sub_paypal_1" });
    const targetPkg = makePackage({ id: "pkg-pro", slug: "pro", paypalPlanId: "plan_pro" });
    const reviseSubscription = vi.fn().mockResolvedValue({
      status: "requires_approval",
      approvalUrl: "https://paypal.com/approve/xyz",
    });
    mockGetProvider.mockResolvedValue({ reviseSubscription });

    prismaMock.company.findUnique.mockResolvedValue(company);
    prismaMock.package.findUnique.mockResolvedValue(targetPkg);

    const result = await upgradeCompanyPackage("company-1", "pro", {
      successUrl: "https://app.test/account/package?paypal_upgrade=1&package=pro",
      cancelUrl: "https://app.test/account/package",
    });

    expect(reviseSubscription).toHaveBeenCalledWith(
      {
        subscriptionId: "sub_paypal_1",
        newPlanRef: "plan_pro",
        isUpgrade: true,
        successUrl: "https://app.test/account/package?paypal_upgrade=1&package=pro",
        cancelUrl: "https://app.test/account/package",
      },
      true,
    );
    expect(result).toEqual({ status: "requires_approval", approvalUrl: "https://paypal.com/approve/xyz" });
    expect(prismaMock.companyPackage.update).not.toHaveBeenCalled();
    expect(prismaMock.invoice.create).not.toHaveBeenCalled();
  });

  it("throws when PayPal requires approval but provides no approval link", async () => {
    const company = makeCompany({ paypalSubscriptionId: "sub_paypal_1" });
    const targetPkg = makePackage({ id: "pkg-pro", slug: "pro", paypalPlanId: "plan_pro" });
    mockGetProvider.mockResolvedValue({
      reviseSubscription: vi.fn().mockResolvedValue({ status: "requires_approval" }),
    });
    prismaMock.company.findUnique.mockResolvedValue(company);
    prismaMock.package.findUnique.mockResolvedValue(targetPkg);

    await expect(upgradeCompanyPackage("company-1", "pro")).rejects.toThrow(/no approval link/i);
  });
});

describe("confirmPendingUpgrade", () => {
  it("polls until the subscription's plan matches, then applies the DB change", async () => {
    vi.useFakeTimers();
    try {
      const company = makeCompany({ paypalSubscriptionId: "sub_paypal_1" });
      const targetPkg = makePackage({ id: "pkg-pro", slug: "pro", paypalPlanId: "plan_pro" });
      const getSubscriptionStatus = vi
        .fn()
        .mockResolvedValueOnce({ status: "ACTIVE", planId: "plan_old" })
        .mockResolvedValueOnce({ status: "ACTIVE", planId: "plan_pro" });
      mockGetProvider.mockResolvedValue({ getSubscriptionStatus });

      prismaMock.company.findUnique.mockResolvedValue(company);
      prismaMock.package.findUnique.mockResolvedValue(targetPkg);
      prismaMock.companyPackage.findUnique.mockResolvedValue(makeCompanyPackage({ packageId: "pkg-old" }));
      prismaMock.$transaction.mockResolvedValue([
        makeCompanyPackage({ packageId: "pkg-pro", package: targetPkg }),
      ]);

      const resultPromise = confirmPendingUpgrade("company-1", "pro");
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(getSubscriptionStatus).toHaveBeenCalledTimes(2);
      expect(prismaMock.companyPackage.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ packageId: "pkg-pro" }) }),
      );
      expect(result.package?.id).toBe("pkg-pro");
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws when the plan still hasn't changed after retrying", async () => {
    vi.useFakeTimers();
    try {
      const company = makeCompany({ paypalSubscriptionId: "sub_paypal_1" });
      const targetPkg = makePackage({ id: "pkg-pro", slug: "pro", paypalPlanId: "plan_pro" });
      mockGetProvider.mockResolvedValue({
        getSubscriptionStatus: vi.fn().mockResolvedValue({ status: "ACTIVE", planId: "plan_old" }),
      });
      prismaMock.company.findUnique.mockResolvedValue(company);
      prismaMock.package.findUnique.mockResolvedValue(targetPkg);

      const assertion = expect(confirmPendingUpgrade("company-1", "pro")).rejects.toThrow(
        /hasn't been approved/i,
      );
      await vi.runAllTimersAsync();
      await assertion;
      expect(prismaMock.companyPackage.update).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("is a no-op if the company is already on the target package (e.g. the webhook already applied it)", async () => {
    const company = makeCompany({ paypalSubscriptionId: "sub_paypal_1" });
    const targetPkg = makePackage({ id: "pkg-pro", slug: "pro", paypalPlanId: "plan_pro" });
    mockGetProvider.mockResolvedValue({
      getSubscriptionStatus: vi.fn().mockResolvedValue({ status: "ACTIVE", planId: "plan_pro" }),
    });
    prismaMock.company.findUnique.mockResolvedValue(company);
    prismaMock.package.findUnique.mockResolvedValue(targetPkg);
    prismaMock.companyPackage.findUnique.mockResolvedValue(
      makeCompanyPackage({ packageId: "pkg-pro", package: targetPkg }),
    );

    await confirmPendingUpgrade("company-1", "pro");

    expect(prismaMock.companyPackage.update).not.toHaveBeenCalled();
    expect(prismaMock.invoice.create).not.toHaveBeenCalled();
  });
});

describe("handlePlanRevisionConfirmed", () => {
  it("looks up the package by its cached PayPal plan ref and applies the change", async () => {
    const targetPkg = makePackage({ id: "pkg-pro", slug: "pro", paypalPlanId: "plan_pro" });
    prismaMock.package.findFirst.mockResolvedValue(targetPkg);
    prismaMock.companyPackage.findUnique.mockResolvedValue(makeCompanyPackage({ packageId: "pkg-old" }));
    prismaMock.$transaction.mockResolvedValue([
      makeCompanyPackage({ packageId: "pkg-pro", package: targetPkg }),
    ]);

    const result = await handlePlanRevisionConfirmed("company-1", "plan_pro");

    expect(prismaMock.package.findFirst).toHaveBeenCalledWith({ where: { paypalPlanId: "plan_pro" } });
    expect(result.package?.id).toBe("pkg-pro");
  });

  it("throws when no package matches the plan id", async () => {
    prismaMock.package.findFirst.mockResolvedValue(null);

    await expect(handlePlanRevisionConfirmed("company-1", "plan_ghost")).rejects.toThrow(/no package found/i);
  });
});

describe("getCheckoutPlanRef", () => {
  it("returns undefined for Stripe — its checkout prices inline, no shared-product constraint", async () => {
    const result = await getCheckoutPlanRef("basic", "stripe", true);

    expect(result).toBeUndefined();
    expect(prismaMock.package.findUnique).not.toHaveBeenCalled();
  });

  it("returns the already-cached PayPal plan ref without creating a new one", async () => {
    prismaMock.package.findUnique.mockResolvedValue(makePackage({ paypalPlanId: "plan_cached" }));

    const result = await getCheckoutPlanRef("basic", "paypal", true);

    expect(result).toBe("plan_cached");
    expect(mockGetProvider).not.toHaveBeenCalled();
  });

  it("creates and caches a PayPal plan ref when the package has none yet, so checkout and later revises share it", async () => {
    const targetPkg = makePackage({ paypalPlanId: null });
    const createPlanRef = vi.fn().mockResolvedValue("plan_fresh");
    mockGetProvider.mockResolvedValue({ createPlanRef });
    prismaMock.package.findUnique.mockResolvedValue(targetPkg);
    prismaMock.package.update.mockResolvedValue({ ...targetPkg, paypalPlanId: "plan_fresh" });

    const result = await getCheckoutPlanRef("basic", "paypal", true);

    expect(createPlanRef).toHaveBeenCalledWith({ slug: "basic", name: "Basic", price: 1900 }, true);
    expect(prismaMock.package.update).toHaveBeenCalledWith({
      where: { id: "pkg-basic" },
      data: { paypalPlanId: "plan_fresh" },
    });
    expect(result).toBe("plan_fresh");
  });

  it("throws when the package doesn't exist", async () => {
    prismaMock.package.findUnique.mockResolvedValue(null);

    await expect(getCheckoutPlanRef("ghost", "paypal", true)).rejects.toThrow(/not found/i);
  });
});

describe("scheduleDowngrade", () => {
  it("Stripe: revises the subscription inertly now and only writes pending fields", async () => {
    const company = makeCompany({ stripeSubscriptionId: "sub_123" });
    const currentPkg = makePackage({ id: "pkg-pro", slug: "pro", price: 2900 });
    const targetPkg = makePackage({ id: "pkg-basic", slug: "basic", price: 1900, stripePriceId: "price_basic" });
    const getCurrentPeriodEnd = vi.fn().mockResolvedValue(future);
    const reviseSubscription = vi.fn().mockResolvedValue({ status: "applied" });
    mockGetProvider.mockResolvedValue({ getCurrentPeriodEnd, reviseSubscription });

    prismaMock.company.findUnique.mockResolvedValue(company);
    prismaMock.companyPackage.findUnique.mockResolvedValue(
      makeCompanyPackage({ packageId: "pkg-pro", package: currentPkg }),
    );
    prismaMock.package.findUnique.mockResolvedValue(targetPkg);
    prismaMock.companyPackage.update.mockResolvedValue(
      makeCompanyPackage({
        packageId: "pkg-pro",
        package: currentPkg,
        pendingPackageId: "pkg-basic",
        pendingEffectiveAt: future,
        pendingPackage: targetPkg,
      }),
    );

    const { effectiveAt } = await scheduleDowngrade("company-1", "basic");

    expect(effectiveAt).toEqual(future);
    expect(reviseSubscription).toHaveBeenCalledWith(
      { subscriptionId: "sub_123", newPlanRef: "price_basic", isUpgrade: false },
      true,
    );
    expect(prismaMock.companyPackage.update).toHaveBeenCalledWith({
      where: { companyId: "company-1" },
      data: { pendingPackageId: "pkg-basic", pendingEffectiveAt: future },
      include: { package: true, pendingPackage: true },
    });
  });

  it("PayPal: does not call the provider at schedule time", async () => {
    const company = makeCompany({ paypalSubscriptionId: "sub_paypal_1" });
    const currentPkg = makePackage({ id: "pkg-pro", slug: "pro", price: 2900 });
    const targetPkg = makePackage({ id: "pkg-basic", slug: "basic", price: 1900, paypalPlanId: "plan_basic" });
    const getCurrentPeriodEnd = vi.fn().mockResolvedValue(future);
    const reviseSubscription = vi.fn();
    mockGetProvider.mockResolvedValue({ getCurrentPeriodEnd, reviseSubscription });

    prismaMock.company.findUnique.mockResolvedValue(company);
    prismaMock.companyPackage.findUnique.mockResolvedValue(
      makeCompanyPackage({ packageId: "pkg-pro", package: currentPkg }),
    );
    prismaMock.package.findUnique.mockResolvedValue(targetPkg);
    prismaMock.companyPackage.update.mockResolvedValue(
      makeCompanyPackage({ pendingPackageId: "pkg-basic", pendingEffectiveAt: future }),
    );

    await scheduleDowngrade("company-1", "basic");

    expect(reviseSubscription).not.toHaveBeenCalled();
  });

  it("rejects a target that isn't actually cheaper", async () => {
    const currentPkg = makePackage({ id: "pkg-basic", slug: "basic", price: 1900 });
    prismaMock.company.findUnique.mockResolvedValue(makeCompany({ stripeSubscriptionId: "sub_1" }));
    prismaMock.companyPackage.findUnique.mockResolvedValue(
      makeCompanyPackage({ packageId: "pkg-basic", package: currentPkg }),
    );
    prismaMock.package.findUnique.mockResolvedValue(
      makePackage({ id: "pkg-pro", slug: "pro", price: 2900 }),
    );

    await expect(scheduleDowngrade("company-1", "pro")).rejects.toThrow(/upgrade path/i);
  });
});

describe("getCompanyPackage lazy-apply of a due downgrade", () => {
  it("Stripe: flips state without any provider call", async () => {
    const pendingPkg = makePackage({ id: "pkg-basic", slug: "basic", price: 1900 });
    const dueCp = makeCompanyPackage({
      packageId: "pkg-pro",
      package: makePackage({ id: "pkg-pro", slug: "pro", price: 2900 }),
      pendingPackageId: "pkg-basic",
      pendingEffectiveAt: past,
      pendingPackage: pendingPkg,
    });
    prismaMock.companyPackage.findUnique.mockResolvedValue(dueCp);
    prismaMock.company.findUnique.mockResolvedValue(makeCompany({ stripeSubscriptionId: "sub_1" }));
    prismaMock.$transaction.mockResolvedValue([
      makeCompanyPackage({ packageId: "pkg-basic", package: pendingPkg }),
    ]);

    const result = await getCompanyPackage("company-1");

    expect(mockGetProvider).not.toHaveBeenCalled();
    expect(result?.package?.id).toBe("pkg-basic");
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it("PayPal: calls reviseSubscription and applies on success", async () => {
    const pendingPkg = makePackage({ id: "pkg-basic", slug: "basic", price: 1900, paypalPlanId: "plan_basic" });
    const dueCp = makeCompanyPackage({
      packageId: "pkg-pro",
      package: makePackage({ id: "pkg-pro", slug: "pro", price: 2900 }),
      pendingPackageId: "pkg-basic",
      pendingEffectiveAt: past,
      pendingPackage: pendingPkg,
    });
    const reviseSubscription = vi.fn().mockResolvedValue({ status: "applied" });
    mockGetProvider.mockResolvedValue({ reviseSubscription });

    prismaMock.companyPackage.findUnique.mockResolvedValue(dueCp);
    prismaMock.company.findUnique.mockResolvedValue(makeCompany({ paypalSubscriptionId: "sub_paypal_1" }));
    prismaMock.$transaction.mockResolvedValue([
      makeCompanyPackage({ packageId: "pkg-basic", package: pendingPkg }),
    ]);

    const result = await getCompanyPackage("company-1");

    expect(reviseSubscription).toHaveBeenCalledWith(
      { subscriptionId: "sub_paypal_1", newPlanRef: "plan_basic", isUpgrade: false },
      true,
    );
    expect(result?.package?.id).toBe("pkg-basic");
  });

  it("PayPal: leaves all state untouched when the provider call fails", async () => {
    const pendingPkg = makePackage({ id: "pkg-basic", slug: "basic", price: 1900, paypalPlanId: "plan_basic" });
    const dueCp = makeCompanyPackage({
      packageId: "pkg-pro",
      package: makePackage({ id: "pkg-pro", slug: "pro", price: 2900 }),
      pendingPackageId: "pkg-basic",
      pendingEffectiveAt: past,
      pendingPackage: pendingPkg,
    });
    const reviseSubscription = vi.fn().mockRejectedValue(new Error("network error"));
    mockGetProvider.mockResolvedValue({ reviseSubscription });

    prismaMock.companyPackage.findUnique.mockResolvedValue(dueCp);
    prismaMock.company.findUnique.mockResolvedValue(makeCompany({ paypalSubscriptionId: "sub_paypal_1" }));

    const result = await getCompanyPackage("company-1");

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(result?.package?.id).toBe("pkg-pro"); // unchanged — still on the old plan
    expect(result?.pendingPackage?.id).toBe("pkg-basic"); // still pending, will retry next read
    expect(mockLogger.error).toHaveBeenCalled();
  });
});

describe("cancelPendingDowngrade", () => {
  it("Stripe: reverts the subscription to the current package's price", async () => {
    const currentPkg = makePackage({ id: "pkg-pro", slug: "pro", price: 2900, stripePriceId: "price_pro" });
    const cp = makeCompanyPackage({
      packageId: "pkg-pro",
      package: currentPkg,
      pendingPackageId: "pkg-basic",
      pendingEffectiveAt: future,
      pendingPackage: makePackage({ id: "pkg-basic", slug: "basic", price: 1900 }),
    });
    const reviseSubscription = vi.fn().mockResolvedValue({ status: "applied" });
    mockGetProvider.mockResolvedValue({ reviseSubscription });

    prismaMock.companyPackage.findUnique.mockResolvedValue(cp);
    prismaMock.company.findUnique.mockResolvedValue(makeCompany({ stripeSubscriptionId: "sub_1" }));
    prismaMock.companyPackage.update.mockResolvedValue(
      makeCompanyPackage({ packageId: "pkg-pro", package: currentPkg }),
    );

    await cancelPendingDowngrade("company-1");

    expect(reviseSubscription).toHaveBeenCalledWith(
      { subscriptionId: "sub_1", newPlanRef: "price_pro", isUpgrade: false },
      true,
    );
    expect(prismaMock.companyPackage.update).toHaveBeenCalledWith({
      where: { companyId: "company-1" },
      data: { pendingPackageId: null, pendingEffectiveAt: null },
      include: { package: true, pendingPackage: true },
    });
  });

  it("PayPal: makes no provider call — nothing was ever charged for the abandoned target", async () => {
    const currentPkg = makePackage({ id: "pkg-pro", slug: "pro", price: 2900 });
    const cp = makeCompanyPackage({
      packageId: "pkg-pro",
      package: currentPkg,
      pendingPackageId: "pkg-basic",
      pendingEffectiveAt: future,
    });

    prismaMock.companyPackage.findUnique.mockResolvedValue(cp);
    prismaMock.company.findUnique.mockResolvedValue(makeCompany({ paypalSubscriptionId: "sub_paypal_1" }));
    prismaMock.companyPackage.update.mockResolvedValue(
      makeCompanyPackage({ packageId: "pkg-pro", package: currentPkg }),
    );

    await cancelPendingDowngrade("company-1");

    expect(mockGetProvider).not.toHaveBeenCalled();
  });

  it("is an idempotent no-op when nothing is pending", async () => {
    const cp = makeCompanyPackage({ pendingPackageId: null });
    prismaMock.companyPackage.findUnique.mockResolvedValue(cp);

    await cancelPendingDowngrade("company-1");

    expect(prismaMock.companyPackage.update).not.toHaveBeenCalled();
  });
});

describe("handlePaymentSuccess cross-provider cleanup", () => {
  it("cancels the old provider's subscription and clears its fields", async () => {
    const cancelSubscription = vi.fn().mockResolvedValue(undefined);
    mockGetProvider.mockImplementation(async (name: string) =>
      name === "stripe" ? { cancelSubscription } : {},
    );

    // paypalPlanId pre-cached so ensureProviderPlanRef (for the NEW paypal
    // subscription) doesn't need a createPlanRef call — that path is covered
    // by the upgradeCompanyPackage tests above.
    prismaMock.package.findUnique.mockResolvedValue(
      makePackage({ id: "pkg-basic", slug: "basic", paypalPlanId: "plan_basic" }),
    );
    prismaMock.company.findUnique.mockResolvedValue(
      makeCompany({ stripeSubscriptionId: "old_stripe_sub", stripeCustomerId: "cus_1" }),
    );
    prismaMock.$transaction.mockResolvedValue([makeCompanyPackage()]);

    await handlePaymentSuccess("company-1", "basic", "paypal", "new_paypal_sub", "buyer@example.com");

    expect(mockGetProvider).toHaveBeenCalledWith("stripe");
    expect(cancelSubscription).toHaveBeenCalledWith("old_stripe_sub", true);

    expect(prismaMock.company.update).toHaveBeenCalledWith({
      where: { id: "company-1" },
      data: expect.objectContaining({
        paypalSubscriptionId: "new_paypal_sub",
        paypalPlanId: "plan_basic",
        stripeSubscriptionId: null,
        stripeCustomerId: null,
      }),
    });
  });

  it("still activates the new plan even if cancelling the old subscription fails", async () => {
    const cancelSubscription = vi.fn().mockRejectedValue(new Error("already cancelled"));
    mockGetProvider.mockImplementation(async (name: string) =>
      name === "stripe" ? { cancelSubscription } : {},
    );

    prismaMock.package.findUnique.mockResolvedValue(
      makePackage({ id: "pkg-basic", slug: "basic", paypalPlanId: "plan_basic" }),
    );
    prismaMock.company.findUnique.mockResolvedValue(
      makeCompany({ stripeSubscriptionId: "old_stripe_sub" }),
    );
    prismaMock.$transaction.mockResolvedValue([makeCompanyPackage()]);

    await expect(
      handlePaymentSuccess("company-1", "basic", "paypal", "new_paypal_sub", "buyer@example.com"),
    ).resolves.toBeDefined();

    expect(mockLogger.error).toHaveBeenCalled();
  });
});

describe("handleSubscriptionCancelled", () => {
  it("sets status to CANCELLED", async () => {
    prismaMock.companyPackage.update.mockResolvedValue(makeCompanyPackage({ status: "CANCELLED" }));

    const result = await handleSubscriptionCancelled("company-1");

    expect(prismaMock.companyPackage.update).toHaveBeenCalledWith({
      where: { companyId: "company-1" },
      data: { status: "CANCELLED" },
      include: { package: true, pendingPackage: true },
    });
    expect(result.status).toBe("CANCELLED");
  });
});

describe("expireTrial", () => {
  it("expires the trial and emails the company", async () => {
    prismaMock.companyPackage.update.mockResolvedValue(
      makeCompanyPackage({ status: "EXPIRED", trialEnd: past }),
    );
    prismaMock.company.findUnique.mockResolvedValue(makeCompany());

    const result = await expireTrial("company-1");

    expect(prismaMock.companyPackage.update).toHaveBeenCalledWith({
      where: { companyId: "company-1" },
      data: { status: "EXPIRED" },
      include: { package: true, pendingPackage: true },
    });
    expect(mockNotify.notifyTrialExpired).toHaveBeenCalledWith({
      to: "test@co.com",
      companyName: "Test Co",
    });
    expect(result.status).toBe("EXPIRED");
  });

  it("still expires without emailing when the company can't be found", async () => {
    prismaMock.companyPackage.update.mockResolvedValue(
      makeCompanyPackage({ status: "EXPIRED" }),
    );
    prismaMock.company.findUnique.mockResolvedValue(null);

    await expireTrial("company-1");

    expect(mockNotify.notifyTrialExpired).not.toHaveBeenCalled();
  });
});

describe("checkAndExpireTrials", () => {
  it("expires overdue trials and emails both expired and expiring companies", async () => {
    const inThreeDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    prismaMock.companyPackage.findMany
      .mockResolvedValueOnce([{ companyId: "company-1" }])
      .mockResolvedValueOnce([{ companyId: "company-2", trialEnd: inThreeDays }]);
    prismaMock.companyPackage.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.company.findUnique
      .mockResolvedValueOnce(makeCompany())
      .mockResolvedValueOnce(makeCompany({ id: "company-2" }));

    const count = await checkAndExpireTrials();

    expect(count).toBe(1);
    expect(prismaMock.companyPackage.updateMany).toHaveBeenCalledWith({
      where: { status: "TRIAL", trialEnd: { lte: expect.any(Date) } },
      data: { status: "EXPIRED" },
    });
    expect(mockNotify.notifyTrialExpired).toHaveBeenCalledWith({
      to: "test@co.com",
      companyName: "Test Co",
    });
    expect(mockNotify.notifyTrialExpiring).toHaveBeenCalledWith({
      to: "test@co.com",
      companyName: "Test Co",
      trialEnd: inThreeDays,
    });
  });

  it("returns 0 and sends nothing when no trials are due or expiring", async () => {
    prismaMock.companyPackage.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const count = await checkAndExpireTrials();

    expect(count).toBe(0);
    expect(prismaMock.companyPackage.updateMany).not.toHaveBeenCalled();
    expect(mockNotify.notifyTrialExpired).not.toHaveBeenCalled();
    expect(mockNotify.notifyTrialExpiring).not.toHaveBeenCalled();
  });
});

describe("countCompaniesOnPackage", () => {
  it("counts both current and pending package matches", async () => {
    prismaMock.companyPackage.count.mockResolvedValue(3);

    const result = await countCompaniesOnPackage("pkg-basic");

    expect(prismaMock.companyPackage.count).toHaveBeenCalledWith({
      where: { OR: [{ packageId: "pkg-basic" }, { pendingPackageId: "pkg-basic" }] },
    });
    expect(result).toBe(3);
  });
});
