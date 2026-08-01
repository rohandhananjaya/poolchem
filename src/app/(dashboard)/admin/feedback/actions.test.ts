import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireSuperAdmin: vi.fn(),
}));
vi.mock("@/lib/db/feedback", () => ({
  updateFeedbackStatus: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { requireSuperAdmin } = await import("@/lib/auth");
const { updateFeedbackStatus } = await import("@/lib/db/feedback");
const { revalidatePath } = await import("next/cache");
const { updateFeedbackStatusAction } = await import("./actions");

const mockAdmin = { id: "admin-1", companyId: null, role: "SUPER_ADMIN" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateFeedbackStatusAction", () => {
  it("updates the status and revalidates", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue(mockAdmin as never);
    vi.mocked(updateFeedbackStatus).mockResolvedValue({
      id: "feedback-1",
      status: "RESOLVED",
    } as never);

    await updateFeedbackStatusAction("feedback-1", "RESOLVED");

    expect(requireSuperAdmin).toHaveBeenCalled();
    expect(updateFeedbackStatus).toHaveBeenCalledWith("feedback-1", "RESOLVED");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/feedback");
  });

  it("throws on an invalid status", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue(mockAdmin as never);

    await expect(
      updateFeedbackStatusAction("feedback-1", "UNKNOWN" as never),
    ).rejects.toThrow("Invalid status.");
    expect(updateFeedbackStatus).not.toHaveBeenCalled();
  });

  it("rethrows when the row does not exist", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue(mockAdmin as never);
    vi.mocked(updateFeedbackStatus).mockRejectedValue(
      new Error("Feedback \"missing\" not found."),
    );

    await expect(
      updateFeedbackStatusAction("missing", "CLOSED"),
    ).rejects.toThrow("not found");
  });
});
