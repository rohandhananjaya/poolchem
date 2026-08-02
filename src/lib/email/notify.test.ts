import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/visits", () => ({
  getVisitById: vi.fn(),
}));
vi.mock("@/lib/db/company", () => ({
  getCompanyById: vi.fn(),
  getCompanyFromEmail: vi.fn(() => "company@poolbench.com"),
}));
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
}));
vi.mock("@/lib/log", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const { getVisitById } = await import("@/lib/db/visits");
const { getCompanyById } = await import("@/lib/db/company");
const { sendEmail } = await import("@/lib/email");
const { logger } = await import("@/lib/log");
const {
  notifyVisitAssigned,
  notifyVisitCancelled,
  notifyReportAvailable,
  notifyInvitation,
  notifyWelcome,
} = await import("./notify");

const companyId = "company-1";
const visitId = "visit-1";

const mockCompany = { id: companyId, name: "PoolCo" };

function mockVisit(overrides: Record<string, unknown> = {}) {
  return {
    id: visitId,
    scheduledAt: new Date("2026-08-03T10:00:00Z"),
    publicToken: "tok_report",
    tech: { id: "user-1", name: "Tess Tech", email: "tess@example.com" },
    pool: { id: "pool-1", name: "Backyard Pool", address: "1 Main St" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCompanyById).mockResolvedValue(mockCompany as never);
});

describe("notifyVisitAssigned", () => {
  it("sends a visit-assigned email to the assigned tech", async () => {
    vi.mocked(getVisitById).mockResolvedValue(mockVisit() as never);

    await notifyVisitAssigned({ companyId, visitId, techId: "user-1" });

    expect(getVisitById).toHaveBeenCalledWith(visitId, companyId);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "tess@example.com",
        from: "company@poolbench.com",
        subject: expect.stringContaining("Backyard Pool"),
      }),
    );
  });

  it("no-ops when no tech is assigned", async () => {
    await notifyVisitAssigned({ companyId, visitId, techId: null });

    expect(getVisitById).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("no-ops when the assignee is unchanged", async () => {
    await notifyVisitAssigned({
      companyId,
      visitId,
      techId: "user-1",
      previousTechId: "user-1",
    });

    expect(getVisitById).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("no-ops when the visit is not found", async () => {
    vi.mocked(getVisitById).mockResolvedValue(null);

    await notifyVisitAssigned({ companyId, visitId, techId: "user-1" });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("no-ops when the tech has no email", async () => {
    vi.mocked(getVisitById).mockResolvedValue(
      mockVisit({ tech: { id: "user-1", name: "Tess Tech", email: null } }) as never,
    );

    await notifyVisitAssigned({ companyId, visitId, techId: "user-1" });

    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("notifyVisitCancelled", () => {
  it("sends a cancellation email with the reason to the assigned tech", async () => {
    vi.mocked(getVisitById).mockResolvedValue(mockVisit() as never);

    await notifyVisitCancelled({ companyId, visitId, reason: "Client request" });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "tess@example.com",
        subject: expect.stringContaining("Backyard Pool"),
        html: expect.stringContaining("Client request"),
      }),
    );
  });

  it("no-ops when the visit is not found", async () => {
    vi.mocked(getVisitById).mockResolvedValue(null);

    await notifyVisitCancelled({ companyId, visitId, reason: "Client request" });

    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("notifyReportAvailable", () => {
  it("sends the shareable report link when the visit has a public token", async () => {
    vi.mocked(getVisitById).mockResolvedValue(mockVisit() as never);

    await notifyReportAvailable({ companyId, visitId, to: "owner@example.com" });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@example.com",
        html: expect.stringContaining("https://localhost:3000/report/tok_report"),
      }),
    );
  });

  it("falls back to the private report page when there is no public token", async () => {
    vi.mocked(getVisitById).mockResolvedValue(
      mockVisit({ publicToken: null }) as never,
    );

    await notifyReportAvailable({ companyId, visitId, to: "owner@example.com" });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining(
          `https://localhost:3000/visits/${visitId}/report`,
        ),
      }),
    );
  });
});

describe("notifyInvitation", () => {
  it("sends an invitation from the company email", async () => {
    await notifyInvitation({
      companyId,
      to: "tech@example.com",
      inviteUrl: "https://localhost:3000/invite/abc",
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "tech@example.com",
        from: "company@poolbench.com",
        html: expect.stringContaining("https://localhost:3000/invite/abc"),
      }),
    );
  });

  it("no-ops when the company can't be found", async () => {
    vi.mocked(getCompanyById).mockResolvedValue(null);

    await notifyInvitation({
      companyId,
      to: "tech@example.com",
      inviteUrl: "https://localhost:3000/invite/abc",
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("notifyWelcome", () => {
  it("sends a welcome email to the new account holder", async () => {
    await notifyWelcome({ to: "owner@example.com", name: "Alice", companyName: "PoolCo" });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@example.com",
        subject: expect.stringContaining("Welcome to Poolbench"),
      }),
    );
  });
});

describe("safeSend failure handling", () => {
  it("never propagates a send failure", async () => {
    vi.mocked(sendEmail).mockResolvedValue({ ok: false, error: "Resend down" });

    await expect(
      notifyWelcome({ to: "owner@example.com", name: "Alice" }),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });

  it("never propagates a thrown error", async () => {
    vi.mocked(sendEmail).mockRejectedValue(new Error("network error"));

    await expect(
      notifyWelcome({ to: "owner@example.com", name: "Alice" }),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});
