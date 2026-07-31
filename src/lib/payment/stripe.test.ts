import { describe, expect, it, beforeEach, vi } from "vitest";

const mockStripeInstance = {
  products: { list: vi.fn(), create: vi.fn() },
  prices: { create: vi.fn() },
  subscriptions: { retrieve: vi.fn(), update: vi.fn(), cancel: vi.fn() },
};

vi.mock("stripe", () => ({
  default: vi.fn(function StripeMock() {
    return mockStripeInstance;
  }),
}));

const { stripeProvider } = await import("@/lib/payment/stripe");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY_SANDBOX = "sk_test_123";
  process.env.STRIPE_SECRET_KEY_LIVE = "sk_live_123";
});

describe("createPlanRef", () => {
  it("creates a new shared product when none exists yet", async () => {
    mockStripeInstance.products.list.mockResolvedValue({ data: [] });
    mockStripeInstance.products.create.mockResolvedValue({ id: "prod_new" });
    mockStripeInstance.prices.create.mockResolvedValue({ id: "price_123" });

    const planRef = await stripeProvider.createPlanRef(
      { slug: "pro", name: "Pro", price: 2900 },
      true,
    );

    expect(mockStripeInstance.products.create).toHaveBeenCalledWith({ name: "Poolbench Subscription" });
    expect(mockStripeInstance.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({ product: "prod_new", unit_amount: 2900, currency: "usd" }),
    );
    expect(planRef).toBe("price_123");
  });

  it("reuses the existing shared product by name instead of creating a new one", async () => {
    mockStripeInstance.products.list.mockResolvedValue({
      data: [{ id: "prod_existing", name: "Poolbench Subscription", active: true }],
    });
    mockStripeInstance.prices.create.mockResolvedValue({ id: "price_456" });

    await stripeProvider.createPlanRef({ slug: "basic", name: "Basic", price: 1900 }, true);

    expect(mockStripeInstance.products.create).not.toHaveBeenCalled();
    expect(mockStripeInstance.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({ product: "prod_existing" }),
    );
  });
});

describe("reviseSubscription", () => {
  it("upgrades with always_invoice proration and returns the charged amount", async () => {
    mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
      items: { data: [{ id: "si_1" }] },
    });
    mockStripeInstance.subscriptions.update.mockResolvedValue({
      latest_invoice: { amount_due: 1000 },
    });

    const result = await stripeProvider.reviseSubscription(
      { subscriptionId: "sub_1", newPlanRef: "price_pro", isUpgrade: true },
      true,
    );

    expect(mockStripeInstance.subscriptions.update).toHaveBeenCalledWith(
      "sub_1",
      expect.objectContaining({
        items: [{ id: "si_1", price: "price_pro" }],
        proration_behavior: "always_invoice",
      }),
    );
    expect(result).toEqual({ status: "applied", prorationAmount: 1000 });
  });

  it("downgrades with no proration and no immediate charge", async () => {
    mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
      items: { data: [{ id: "si_1" }] },
    });
    mockStripeInstance.subscriptions.update.mockResolvedValue({ latest_invoice: null });

    const result = await stripeProvider.reviseSubscription(
      { subscriptionId: "sub_1", newPlanRef: "price_basic", isUpgrade: false },
      true,
    );

    expect(mockStripeInstance.subscriptions.update).toHaveBeenCalledWith(
      "sub_1",
      expect.objectContaining({ proration_behavior: "none" }),
    );
    expect(result).toEqual({ status: "applied", prorationAmount: undefined });
  });

  it("throws if the subscription has no line items to revise", async () => {
    mockStripeInstance.subscriptions.retrieve.mockResolvedValue({ items: { data: [] } });

    await expect(
      stripeProvider.reviseSubscription(
        { subscriptionId: "sub_1", newPlanRef: "price_basic", isUpgrade: false },
        true,
      ),
    ).rejects.toThrow(/no line items/i);
  });
});

describe("getCurrentPeriodEnd", () => {
  it("reads the subscription item's current_period_end", async () => {
    mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
      items: { data: [{ current_period_end: 1780000000 }] },
    });

    const result = await stripeProvider.getCurrentPeriodEnd("sub_1", true);

    expect(result).toEqual(new Date(1780000000 * 1000));
  });

  it("throws when current_period_end is missing", async () => {
    mockStripeInstance.subscriptions.retrieve.mockResolvedValue({ items: { data: [] } });

    await expect(stripeProvider.getCurrentPeriodEnd("sub_1", true)).rejects.toThrow(
      /current_period_end/i,
    );
  });
});
