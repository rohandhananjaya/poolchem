import { describe, expect, it, beforeEach, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { paypalProvider } = await import("@/lib/payment/paypal");

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PAYPAL_CLIENT_ID_SANDBOX = "client_id";
  process.env.PAYPAL_CLIENT_SECRET_SANDBOX = "client_secret";
  process.env.PAYPAL_WEBHOOK_ID_SANDBOX = "webhook_id";

  // Every call sequence starts with an OAuth token fetch.
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes("/v1/oauth2/token")) {
      return jsonResponse({ access_token: "tok_123", token_type: "Bearer", expires_in: 3600 });
    }
    throw new Error(`Unhandled fetch in test: ${url}`);
  });
});

describe("createPlanRef", () => {
  it("creates a product (if none exists yet) and a billing plan, returning the plan id", async () => {
    mockFetch.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url.includes("/v1/oauth2/token")) {
        return jsonResponse({ access_token: "tok_123", token_type: "Bearer", expires_in: 3600 });
      }
      if (url.includes("/v1/catalogs/products?")) {
        return jsonResponse({ products: [] });
      }
      if (url.includes("/v1/catalogs/products") && options?.method === "POST") {
        return jsonResponse({ id: "prod_123" });
      }
      if (url.includes("/v1/billing/plans") && options?.method === "POST") {
        return jsonResponse({ id: "plan_abc" });
      }
      throw new Error(`Unhandled fetch in test: ${url}`);
    });

    const planRef = await paypalProvider.createPlanRef({ slug: "pro", name: "Pro", price: 2900 }, true);

    expect(planRef).toBe("plan_abc");
  });

  it("reuses the existing product by name instead of creating a second one", async () => {
    const productCreateCalls: string[] = [];
    mockFetch.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url.includes("/v1/oauth2/token")) {
        return jsonResponse({ access_token: "tok_123", token_type: "Bearer", expires_in: 3600 });
      }
      if (url.includes("/v1/catalogs/products?")) {
        return jsonResponse({ products: [{ id: "prod_existing", name: "Poolbench Subscription" }] });
      }
      if (url.includes("/v1/catalogs/products") && options?.method === "POST") {
        productCreateCalls.push(url);
        return jsonResponse({ id: "prod_new" });
      }
      if (url.includes("/v1/billing/plans") && options?.method === "POST") {
        return jsonResponse({ id: "plan_xyz" });
      }
      throw new Error(`Unhandled fetch in test: ${url}`);
    });

    const planRef = await paypalProvider.createPlanRef({ slug: "basic", name: "Basic", price: 1900 }, true);

    expect(planRef).toBe("plan_xyz");
    // Reusing the matched product avoids minting a second one under the same
    // name — two products would make their plans PLAN_PRODUCT_NOT_COMPATIBLE.
    expect(productCreateCalls).toHaveLength(0);
  });
});

describe("reviseSubscription", () => {
  it("returns applied when no approval link is returned", async () => {
    mockFetch.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url.includes("/v1/oauth2/token")) {
        return jsonResponse({ access_token: "tok_123", token_type: "Bearer", expires_in: 3600 });
      }
      if (url.includes("/revise") && options?.method === "POST") {
        return jsonResponse({ links: [] });
      }
      throw new Error(`Unhandled fetch in test: ${url}`);
    });

    const result = await paypalProvider.reviseSubscription(
      { subscriptionId: "sub_1", newPlanRef: "plan_basic", isUpgrade: false },
      true,
    );

    expect(result).toEqual({ status: "applied" });
  });

  it("returns requires_approval with the approval url when PayPal asks for re-approval", async () => {
    mockFetch.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url.includes("/v1/oauth2/token")) {
        return jsonResponse({ access_token: "tok_123", token_type: "Bearer", expires_in: 3600 });
      }
      if (url.includes("/revise") && options?.method === "POST") {
        return jsonResponse({ links: [{ rel: "approve", href: "https://paypal.com/approve/123" }] });
      }
      throw new Error(`Unhandled fetch in test: ${url}`);
    });

    const result = await paypalProvider.reviseSubscription(
      { subscriptionId: "sub_1", newPlanRef: "plan_pro", isUpgrade: true },
      true,
    );

    expect(result).toEqual({ status: "requires_approval", approvalUrl: "https://paypal.com/approve/123" });
  });

  it("includes a return/cancel url in application_context when given, so PayPal can send the subscriber back", async () => {
    let capturedBody: unknown;
    mockFetch.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url.includes("/v1/oauth2/token")) {
        return jsonResponse({ access_token: "tok_123", token_type: "Bearer", expires_in: 3600 });
      }
      if (url.includes("/revise") && options?.method === "POST") {
        capturedBody = JSON.parse(options.body as string);
        return jsonResponse({ links: [] });
      }
      throw new Error(`Unhandled fetch in test: ${url}`);
    });

    await paypalProvider.reviseSubscription(
      {
        subscriptionId: "sub_1",
        newPlanRef: "plan_pro",
        isUpgrade: true,
        successUrl: "https://app.test/account/package?paypal_upgrade=1&package=pro",
        cancelUrl: "https://app.test/account/package",
      },
      true,
    );

    expect(capturedBody).toMatchObject({
      plan_id: "plan_pro",
      application_context: {
        return_url: "https://app.test/account/package?paypal_upgrade=1&package=pro",
        cancel_url: "https://app.test/account/package",
      },
    });
  });

  it("omits application_context when no return/cancel url is given", async () => {
    let capturedBody: unknown;
    mockFetch.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url.includes("/v1/oauth2/token")) {
        return jsonResponse({ access_token: "tok_123", token_type: "Bearer", expires_in: 3600 });
      }
      if (url.includes("/revise") && options?.method === "POST") {
        capturedBody = JSON.parse(options.body as string);
        return jsonResponse({ links: [] });
      }
      throw new Error(`Unhandled fetch in test: ${url}`);
    });

    await paypalProvider.reviseSubscription(
      { subscriptionId: "sub_1", newPlanRef: "plan_basic", isUpgrade: false },
      true,
    );

    expect(capturedBody).toEqual({ plan_id: "plan_basic" });
  });

  it("throws when the revise call fails", async () => {
    mockFetch.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url.includes("/v1/oauth2/token")) {
        return jsonResponse({ access_token: "tok_123", token_type: "Bearer", expires_in: 3600 });
      }
      if (url.includes("/revise") && options?.method === "POST") {
        return jsonResponse({ message: "boom" }, false, 500);
      }
      throw new Error(`Unhandled fetch in test: ${url}`);
    });

    await expect(
      paypalProvider.reviseSubscription(
        { subscriptionId: "sub_1", newPlanRef: "plan_basic", isUpgrade: false },
        true,
      ),
    ).rejects.toThrow(/revise failed/i);
  });
});

describe("getSubscriptionStatus", () => {
  it("includes the subscription's current plan id", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/v1/oauth2/token")) {
        return jsonResponse({ access_token: "tok_123", token_type: "Bearer", expires_in: 3600 });
      }
      if (url.includes("/v1/billing/subscriptions/sub_1")) {
        return jsonResponse({
          status: "ACTIVE",
          plan_id: "plan_pro",
          subscriber: { email_address: "a@b.com" },
          custom_id: "company-1:pro",
        });
      }
      throw new Error(`Unhandled fetch in test: ${url}`);
    });

    const result = await paypalProvider.getSubscriptionStatus!("sub_1", true);

    expect(result).toEqual({
      status: "ACTIVE",
      providerCustomerId: "a@b.com",
      companyId: "company-1",
      packageSlug: "pro",
      planId: "plan_pro",
    });
  });
});

describe("handleWebhook", () => {
  it("maps BILLING.SUBSCRIPTION.UPDATED to subscription_plan_changed with the revised plan id", async () => {
    const payload = JSON.stringify({
      event_type: "BILLING.SUBSCRIPTION.UPDATED",
      resource: {
        id: "sub_1",
        plan_id: "plan_pro",
        // custom_id still reflects the ORIGINAL signup package ("basic") —
        // the new plan is only knowable via plan_id, not this field.
        custom_id: "company-1:basic",
        subscriber: { email_address: "a@b.com" },
      },
    });

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/v1/oauth2/token")) {
        return jsonResponse({ access_token: "tok_123", token_type: "Bearer", expires_in: 3600 });
      }
      if (url.includes("/v1/notifications/verify-webhook-signature")) {
        return jsonResponse({ verification_status: "SUCCESS" });
      }
      throw new Error(`Unhandled fetch in test: ${url}`);
    });

    const result = await paypalProvider.handleWebhook(payload, {}, true);

    expect(result).toEqual({
      event: "subscription_plan_changed",
      providerSubscriptionId: "sub_1",
      providerCustomerId: "a@b.com",
      companyId: "company-1",
      providerPlanId: "plan_pro",
    });
  });
});

describe("getCurrentPeriodEnd", () => {
  it("reads billing_info.next_billing_time", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/v1/oauth2/token")) {
        return jsonResponse({ access_token: "tok_123", token_type: "Bearer", expires_in: 3600 });
      }
      if (url.includes("/v1/billing/subscriptions/sub_1")) {
        return jsonResponse({ billing_info: { next_billing_time: "2026-02-01T00:00:00Z" } });
      }
      throw new Error(`Unhandled fetch in test: ${url}`);
    });

    const result = await paypalProvider.getCurrentPeriodEnd("sub_1", true);

    expect(result).toEqual(new Date("2026-02-01T00:00:00Z"));
  });

  it("throws when next_billing_time is missing", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/v1/oauth2/token")) {
        return jsonResponse({ access_token: "tok_123", token_type: "Bearer", expires_in: 3600 });
      }
      if (url.includes("/v1/billing/subscriptions/sub_1")) {
        return jsonResponse({ billing_info: {} });
      }
      throw new Error(`Unhandled fetch in test: ${url}`);
    });

    await expect(paypalProvider.getCurrentPeriodEnd("sub_1", true)).rejects.toThrow(
      /next_billing_time/i,
    );
  });
});
