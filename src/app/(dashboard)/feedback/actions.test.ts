import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/db/feedback", () => ({
  createFeedback: vi.fn(),
}));
vi.mock("@/lib/db/users", () => ({
  getAllUsers: vi.fn(),
}));
vi.mock("@/lib/db/company", () => ({
  getCompanyById: vi.fn(),
}));
vi.mock("@/lib/email/notify", () => ({
  notifyFeedbackAlert: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { requireAuth } = await import("@/lib/auth");
const { createFeedback } = await import("@/lib/db/feedback");
const { getAllUsers } = await import("@/lib/db/users");
const { getCompanyById } = await import("@/lib/db/company");
const { notifyFeedbackAlert } = await import("@/lib/email/notify");
const { revalidatePath } = await import("next/cache");
const { submitFeedbackAction } = await import("./actions");

const mockUser = { id: "user-1", companyId: "company-1", role: "TECH", name: "Tess Tech", email: "tess@example.com" };

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.append(key, value);
  }
  return fd;
}

const VALID = {
  type: "BUG_REPORT",
  title: "App crashes on scan",
  description: "Scanning a pool QR crashes the app.",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("submitFeedbackAction", () => {
  it("submits feedback scoped to the user and company", async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);
    vi.mocked(createFeedback).mockResolvedValue({ id: "feedback-1" } as never);
    vi.mocked(getAllUsers).mockResolvedValue([
      { id: "admin-1", email: "admin@poolbench.com", role: "SUPER_ADMIN" },
    ] as never);
    vi.mocked(getCompanyById).mockResolvedValue({ name: "Pool Co" } as never);

    const result = await submitFeedbackAction({ ok: false }, formData(VALID));

    expect(result).toEqual({ ok: true });
    expect(createFeedback).toHaveBeenCalledWith(
      { type: "BUG_REPORT", title: VALID.title, description: VALID.description },
      "user-1",
      "company-1",
    );
    expect(notifyFeedbackAlert).toHaveBeenCalledWith({
      to: "admin@poolbench.com",
      type: "Bug report",
      title: VALID.title,
      description: VALID.description,
      submitterName: "Tess Tech",
      submitterEmail: "tess@example.com",
      companyName: "Pool Co",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/feedback");
  });

  it("stores a null tenant for company-less users", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      ...mockUser,
      companyId: null,
    } as never);
    vi.mocked(createFeedback).mockResolvedValue({ id: "feedback-1" } as never);
    vi.mocked(getAllUsers).mockResolvedValue([] as never);

    const result = await submitFeedbackAction(
      { ok: false },
      formData({ ...VALID, type: "FEATURE_REQUEST" }),
    );

    expect(createFeedback).toHaveBeenCalledWith(
      { type: "FEATURE_REQUEST", title: VALID.title, description: VALID.description },
      "user-1",
      null,
    );
    expect(notifyFeedbackAlert).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it("returns an error when the type is missing", async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);

    const result = await submitFeedbackAction(
      { ok: false },
      formData({ title: VALID.title, description: VALID.description }),
    );

    expect(result).toEqual({ ok: false, error: "Please choose a report type." });
    expect(createFeedback).not.toHaveBeenCalled();
  });

  it("returns an error when the type is invalid", async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);

    const result = await submitFeedbackAction(
      { ok: false },
      formData({ ...VALID, type: "UNKNOWN" }),
    );

    expect(result).toEqual({ ok: false, error: "Please choose a report type." });
    expect(createFeedback).not.toHaveBeenCalled();
  });

  it("returns an error when the title is empty", async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);

    const result = await submitFeedbackAction(
      { ok: false },
      formData({ ...VALID, title: "   " }),
    );

    expect(result).toEqual({ ok: false, error: "A short title is required." });
    expect(createFeedback).not.toHaveBeenCalled();
  });

  it("returns an error when the description is empty", async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);

    const result = await submitFeedbackAction(
      { ok: false },
      formData({ ...VALID, description: "" }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Please describe what you ran into.",
    });
    expect(createFeedback).not.toHaveBeenCalled();
  });

  it("returns an error when the title is too long", async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);

    const result = await submitFeedbackAction(
      { ok: false },
      formData({ ...VALID, title: "x".repeat(121) }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Title must be 120 characters or fewer.",
    });
    expect(createFeedback).not.toHaveBeenCalled();
  });

  it("returns an error when persisting fails", async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);
    vi.mocked(createFeedback).mockRejectedValue(new Error("db down"));

    const result = await submitFeedbackAction({ ok: false }, formData(VALID));

    expect(result).toEqual({
      ok: false,
      error: "Could not submit your report. Please try again.",
    });
  });
});
