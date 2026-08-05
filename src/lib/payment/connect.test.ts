import { describe, expect, it, beforeEach, vi } from "vitest";

const mockStripeInstance = {
  accounts: { create: vi.fn(), retrieve: vi.fn(), del: vi.fn() },
  accountLinks: { create: vi.fn() },
};

vi.mock("stripe", () => ({
  default: vi.fn(function StripeMock() {
    return mockStripeInstance;
  }),
}));

const { createConnectOnboardingLink, getConnectAccountStatus, disconnectConnectAccount } =
  await import("@/lib/payment/connect");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY_SANDBOX = "sk_test_123";
  process.env.STRIPE_SECRET_KEY_LIVE = "sk_live_123";
});

describe("createConnectOnboardingLink", () => {
  it("creates a new Express account when none exists yet", async () => {
    mockStripeInstance.accounts.create.mockResolvedValue({ id: "acct_new" });
    mockStripeInstance.accountLinks.create.mockResolvedValue({ url: "https://connect.stripe.com/setup/new" });

    const result = await createConnectOnboardingLink(
      {
        companyEmail: "owner@pool.co",
        existingAccountId: null,
        returnUrl: "https://app.test/settings?stripe_connect=return",
        refreshUrl: "https://app.test/settings?stripe_connect=refresh",
      },
      true,
    );

    expect(mockStripeInstance.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "express", email: "owner@pool.co" }),
    );
    expect(mockStripeInstance.accountLinks.create).toHaveBeenCalledWith(
      expect.objectContaining({ account: "acct_new", type: "account_onboarding" }),
    );
    expect(result).toEqual({ url: "https://connect.stripe.com/setup/new", accountId: "acct_new" });
  });

  it("reuses an existing account instead of creating a new one", async () => {
    mockStripeInstance.accountLinks.create.mockResolvedValue({ url: "https://connect.stripe.com/setup/existing" });

    const result = await createConnectOnboardingLink(
      {
        companyEmail: "owner@pool.co",
        existingAccountId: "acct_existing",
        returnUrl: "https://app.test/settings?stripe_connect=return",
        refreshUrl: "https://app.test/settings?stripe_connect=refresh",
      },
      true,
    );

    expect(mockStripeInstance.accounts.create).not.toHaveBeenCalled();
    expect(mockStripeInstance.accountLinks.create).toHaveBeenCalledWith(
      expect.objectContaining({ account: "acct_existing" }),
    );
    expect(result.accountId).toBe("acct_existing");
  });
});

describe("getConnectAccountStatus", () => {
  it("maps the account's capability flags", async () => {
    mockStripeInstance.accounts.retrieve.mockResolvedValue({
      charges_enabled: true,
      details_submitted: true,
      payouts_enabled: false,
    });

    const status = await getConnectAccountStatus("acct_1", true);

    expect(status).toEqual({
      chargesEnabled: true,
      detailsSubmitted: true,
      payoutsEnabled: false,
    });
  });
});

describe("disconnectConnectAccount", () => {
  it("deletes the connected account on Stripe", async () => {
    await disconnectConnectAccount("acct_1", true);

    expect(mockStripeInstance.accounts.del).toHaveBeenCalledWith("acct_1");
  });
});
