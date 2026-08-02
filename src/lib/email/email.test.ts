import { describe, expect, it, beforeEach, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn(function () {
    this.emails = { send: mockSend };
  }),
}));

const { sendEmail } = await import("@/lib/email");
const {
  buildReportShareEmail,
  buildInvitationEmail,
  buildWelcomeEmail,
  buildPasswordResetEmail,
  buildVisitAssignedEmail,
  buildVisitCancelledEmail,
  buildPaymentReceiptEmail,
  buildSubscriptionCancelledEmail,
  buildTrialExpiringEmail,
  buildTrialExpiredEmail,
  buildDowngradeScheduledEmail,
  buildFeedbackAlertEmail,
} = await import("@/lib/email/templates");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildReportShareEmail", () => {
  it("returns an email payload with correct fields", () => {
    const email = buildReportShareEmail({
      to: "homeowner@example.com",
      from: "noreply@poolbench.com",
      companyName: "PoolCo",
      poolName: "Backyard Pool",
      reportUrl: "https://poolbench.com/report/abc123",
    });

    expect(email.to).toBe("homeowner@example.com");
    expect(email.from).toBe("noreply@poolbench.com");
    expect(email.subject).toContain("Backyard Pool");
    expect(email.html).toContain("PoolCo");
    expect(email.html).toContain("https://poolbench.com/report/abc123");
  });
});

describe("buildInvitationEmail", () => {
  it("returns an email payload with correct fields", () => {
    const email = buildInvitationEmail({
      to: "tech@example.com",
      from: "noreply@poolbench.com",
      companyName: "PoolCo",
      inviteUrl: "https://poolbench.com/invite/token123",
    });

    expect(email.to).toBe("tech@example.com");
    expect(email.from).toBe("noreply@poolbench.com");
    expect(email.subject).toContain("PoolCo");
    expect(email.html).toContain("https://poolbench.com/invite/token123");
  });
});

describe("buildWelcomeEmail", () => {
  it("includes the dashboard link and company name", () => {
    const email = buildWelcomeEmail({
      to: "owner@example.com",
      from: "noreply@poolbench.com",
      name: "Alice",
      companyName: "PoolCo",
      dashboardUrl: "https://poolbench.com/dashboard",
    });

    expect(email.subject).toContain("Welcome to Poolbench");
    expect(email.html).toContain("Alice");
    expect(email.html).toContain("PoolCo");
    expect(email.html).toContain("https://poolbench.com/dashboard");
  });

  it("omits the company line when no company is set", () => {
    const email = buildWelcomeEmail({
      to: "admin@poolbench.com",
      from: "noreply@poolbench.com",
      name: "Admin",
      dashboardUrl: "https://poolbench.com/dashboard",
    });

    expect(email.html).not.toContain("is set up and ready to go");
  });
});

describe("buildPasswordResetEmail", () => {
  it("contains the single-use reset link", () => {
    const email = buildPasswordResetEmail({
      to: "owner@example.com",
      from: "noreply@poolbench.com",
      resetUrl: "https://poolbench.com/auth/update-password",
    });

    expect(email.subject).toContain("Reset your Poolbench password");
    expect(email.html).toContain("https://poolbench.com/auth/update-password");
  });
});

describe("buildVisitAssignedEmail", () => {
  it("includes pool, address, scheduled date, and visit link", () => {
    const email = buildVisitAssignedEmail({
      to: "tech@example.com",
      from: "noreply@poolbench.com",
      techName: "Tess",
      poolName: "Backyard Pool",
      address: "1 Main St",
      scheduledDate: "Mon, Aug 3",
      visitUrl: "https://poolbench.com/visits/v1",
    });

    expect(email.subject).toContain("Backyard Pool");
    expect(email.html).toContain("1 Main St");
    expect(email.html).toContain("Mon, Aug 3");
    expect(email.html).toContain("https://poolbench.com/visits/v1");
  });

  it("works without an address or date", () => {
    const email = buildVisitAssignedEmail({
      to: "tech@example.com",
      from: "noreply@poolbench.com",
      techName: "Tess",
      poolName: "Backyard Pool",
      visitUrl: "https://poolbench.com/visits/v1",
    });

    expect(email.html).not.toContain("scheduled for");
  });
});

describe("buildVisitCancelledEmail", () => {
  it("includes the pool and cancellation reason", () => {
    const email = buildVisitCancelledEmail({
      to: "tech@example.com",
      from: "noreply@poolbench.com",
      techName: "Tess",
      poolName: "Backyard Pool",
      reason: "Client cancelled",
      scheduleUrl: "https://poolbench.com/schedule",
    });

    expect(email.subject).toContain("Backyard Pool");
    expect(email.html).toContain("Client cancelled");
    expect(email.html).toContain("https://poolbench.com/schedule");
  });
});

describe("buildPaymentReceiptEmail", () => {
  it("formats the amount and links to billing", () => {
    const email = buildPaymentReceiptEmail({
      to: "owner@example.com",
      from: "noreply@poolbench.com",
      companyName: "PoolCo",
      packageName: "Pro",
      amount: 2900,
      invoiceUrl: "https://poolbench.com/account/package",
    });

    expect(email.subject).toContain("Pro");
    expect(email.html).toContain("$2,900");
    expect(email.html).toContain("https://poolbench.com/account/package");
  });

  it("omits the amount line when amount is absent", () => {
    const email = buildPaymentReceiptEmail({
      to: "owner@example.com",
      from: "noreply@poolbench.com",
      companyName: "PoolCo",
      packageName: "Pro",
      invoiceUrl: "https://poolbench.com/account/package",
    });

    expect(email.html).not.toContain("/month");
  });
});

describe("buildSubscriptionCancelledEmail", () => {
  it("mentions the cancelled plan and billing link", () => {
    const email = buildSubscriptionCancelledEmail({
      to: "owner@example.com",
      from: "noreply@poolbench.com",
      companyName: "PoolCo",
      packageName: "Pro",
      packageUrl: "https://poolbench.com/account/package",
    });

    expect(email.subject).toContain("cancelled");
    expect(email.html).toContain("Pro");
    expect(email.html).toContain("https://poolbench.com/account/package");
  });
});

describe("buildTrialExpiringEmail", () => {
  it("includes the trial end date and plan link", () => {
    const email = buildTrialExpiringEmail({
      to: "owner@example.com",
      from: "noreply@poolbench.com",
      companyName: "PoolCo",
      trialEnd: "August 3, 2026",
      packageUrl: "https://poolbench.com/account/package",
    });

    expect(email.subject).toContain("trial ends soon");
    expect(email.html).toContain("August 3, 2026");
    expect(email.html).toContain("https://poolbench.com/account/package");
  });
});

describe("buildTrialExpiredEmail", () => {
  it("links to the plan chooser", () => {
    const email = buildTrialExpiredEmail({
      to: "owner@example.com",
      from: "noreply@poolbench.com",
      companyName: "PoolCo",
      packageUrl: "https://poolbench.com/account/package",
    });

    expect(email.subject).toContain("trial has ended");
    expect(email.html).toContain("https://poolbench.com/account/package");
  });
});

describe("buildDowngradeScheduledEmail", () => {
  it("names both plans and the effective date", () => {
    const email = buildDowngradeScheduledEmail({
      to: "owner@example.com",
      from: "noreply@poolbench.com",
      companyName: "PoolCo",
      currentPackageName: "Pro",
      targetPackageName: "Basic",
      effectiveAt: "February 1, 2026",
      packageUrl: "https://poolbench.com/account/package",
    });

    expect(email.subject).toContain("Basic");
    expect(email.html).toContain("Pro");
    expect(email.html).toContain("February 1, 2026");
  });
});

describe("buildFeedbackAlertEmail", () => {
  it("includes type, description, submitter, and admin link", () => {
    const email = buildFeedbackAlertEmail({
      to: "admin@poolbench.com",
      from: "noreply@poolbench.com",
      type: "Bug report",
      title: "Schedule crashes",
      description: "Repro steps",
      submitterName: "Tess",
      submitterEmail: "tess@example.com",
      companyName: "PoolCo",
      adminUrl: "https://poolbench.com/admin/feedback",
    });

    expect(email.subject).toContain("Schedule crashes");
    expect(email.html).toContain("Bug report");
    expect(email.html).toContain("Repro steps");
    expect(email.html).toContain("tess@example.com");
    expect(email.html).toContain("PoolCo");
    expect(email.html).toContain("https://poolbench.com/admin/feedback");
  });
});

describe("sendEmail", () => {
  const validInput = {
    to: "test@example.com",
    from: "noreply@poolbench.com",
    subject: "Test",
    html: "<p>Test</p>",
  };

  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test";
  });

  it("sends email successfully", async () => {
    mockSend.mockResolvedValue({ error: null });

    const result = await sendEmail(validInput);

    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@example.com",
        subject: "Test",
      }),
    );
  });

  it("returns error when Resend fails", async () => {
    mockSend.mockResolvedValue({ error: { message: "Invalid API key" } });

    const result = await sendEmail(validInput);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Invalid API key");
  });

  it("returns error when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendEmail(validInput);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("RESEND_API_KEY");
  });
});
