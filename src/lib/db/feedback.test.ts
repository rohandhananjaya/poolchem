import { describe, expect, it, beforeEach, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { prismaMock } from "@/test/prisma-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const {
  createFeedback,
  getFeedbackByUser,
  getAllFeedback,
  updateFeedbackStatus,
  FEEDBACK_PAGE_SIZE,
} = await import("@/lib/db/feedback");

const userId = "user-1";
const companyId = "company-1";
const feedbackId = "feedback-1";

const mockFeedback = {
  id: feedbackId,
  type: "BUG_REPORT",
  title: "App crashes on scan",
  description: "Scanning a QR crashes the app.",
  status: "OPEN",
  companyId,
  userId,
  createdAt: new Date("2026-07-01"),
  updatedAt: new Date("2026-07-01"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createFeedback", () => {
  it("persists the submission with user and tenant scope", async () => {
    prismaMock.feedback.create.mockResolvedValue(mockFeedback);

    const result = await createFeedback(
      { type: "BUG_REPORT", title: "App crashes on scan", description: "Scanning a QR crashes the app." },
      userId,
      companyId,
    );

    expect(prismaMock.feedback.create).toHaveBeenCalledWith({
      data: {
        type: "BUG_REPORT",
        title: "App crashes on scan",
        description: "Scanning a QR crashes the app.",
        userId,
        companyId,
      },
    });
    expect(result).toEqual(mockFeedback);
  });

  it("stores a null tenant for company-less submitters", async () => {
    prismaMock.feedback.create.mockResolvedValue({
      ...mockFeedback,
      companyId: null,
    });

    await createFeedback(
      { type: "FEATURE_REQUEST", title: "Dark mode", description: "Add dark mode." },
      userId,
      null,
    );

    expect(prismaMock.feedback.create).toHaveBeenCalledWith({
      data: {
        type: "FEATURE_REQUEST",
        title: "Dark mode",
        description: "Add dark mode.",
        userId,
        companyId: null,
      },
    });
  });
});

describe("getFeedbackByUser", () => {
  it("scopes by user and tenant, newest first", async () => {
    prismaMock.feedback.findMany.mockResolvedValue([mockFeedback]);

    const result = await getFeedbackByUser(userId, companyId);

    expect(prismaMock.feedback.findMany).toHaveBeenCalledWith({
      where: { userId, companyId },
      orderBy: { createdAt: "desc" },
    });
    expect(result).toEqual([mockFeedback]);
  });

  it("scopes by user only when the user has no tenant", async () => {
    prismaMock.feedback.findMany.mockResolvedValue([]);

    await getFeedbackByUser(userId, null);

    expect(prismaMock.feedback.findMany).toHaveBeenCalledWith({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("getAllFeedback", () => {
  const submitter = { user: { name: "A Tech", email: "tech@co.com" }, company: { name: "Test Co" } };

  it("returns the first page with no filters", async () => {
    prismaMock.feedback.findMany.mockResolvedValue([{ ...mockFeedback, ...submitter }]);
    prismaMock.feedback.count.mockResolvedValue(1);

    const result = await getAllFeedback();

    expect(prismaMock.feedback.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: FEEDBACK_PAGE_SIZE,
      include: {
        user: { select: { name: true, email: true } },
        company: { select: { name: true } },
      },
    });
    expect(result.total).toBe(1);
    expect(result.feedback[0].user.email).toBe("tech@co.com");
  });

  it("applies page, type, and status filters", async () => {
    prismaMock.feedback.findMany.mockResolvedValue([]);
    prismaMock.feedback.count.mockResolvedValue(0);

    await getAllFeedback({ page: 3, type: "FEATURE_REQUEST", status: "OPEN" });

    expect(prismaMock.feedback.findMany).toHaveBeenCalledWith({
      where: { type: "FEATURE_REQUEST", status: "OPEN" },
      orderBy: { createdAt: "desc" },
      skip: (3 - 1) * FEEDBACK_PAGE_SIZE,
      take: FEEDBACK_PAGE_SIZE,
      include: {
        user: { select: { name: true, email: true } },
        company: { select: { name: true } },
      },
    });
    expect(prismaMock.feedback.count).toHaveBeenCalledWith({
      where: { type: "FEATURE_REQUEST", status: "OPEN" },
    });
  });

  it("clamps negative or zero pages to page 1", async () => {
    prismaMock.feedback.findMany.mockResolvedValue([]);
    prismaMock.feedback.count.mockResolvedValue(0);

    await getAllFeedback({ page: -2 });

    expect(prismaMock.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: FEEDBACK_PAGE_SIZE }),
    );
  });
});

describe("updateFeedbackStatus", () => {
  it("updates the status and returns the row", async () => {
    prismaMock.feedback.update.mockResolvedValue({
      ...mockFeedback,
      status: "RESOLVED",
    });

    const result = await updateFeedbackStatus(feedbackId, "RESOLVED");

    expect(prismaMock.feedback.update).toHaveBeenCalledWith({
      where: { id: feedbackId },
      data: { status: "RESOLVED" },
    });
    expect(result.status).toBe("RESOLVED");
  });

  it("throws a friendly error on P2025", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("Not found", {
      code: "P2025",
      clientVersion: "7",
    });
    prismaMock.feedback.update.mockRejectedValue(error);

    await expect(updateFeedbackStatus("missing", "CLOSED")).rejects.toThrow(
      /not found/i,
    );
  });
});
