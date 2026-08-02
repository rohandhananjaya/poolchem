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
const { buildReportShareEmail, buildInvitationEmail } = await import(
  "@/lib/email/templates"
);

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
