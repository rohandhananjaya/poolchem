import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/db/push-devices", () => ({
  registerPushDevice: vi.fn(),
  unregisterPushDevice: vi.fn(),
}));

const { requireAuth } = await import("@/lib/auth");
const { registerPushDevice, unregisterPushDevice } = await import("@/lib/db/push-devices");
const {
  registerPushDeviceAction,
  unregisterPushDeviceAction,
} = await import("./actions");

const mockUser = { id: "user-1", companyId: "company-1" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registerPushDeviceAction", () => {
  it("registers the token for the current user", async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);

    const result = await registerPushDeviceAction({
      token: "tok-abc",
      platform: "ANDROID",
    });

    expect(result).toEqual({ ok: true });
    expect(registerPushDevice).toHaveBeenCalledWith({
      companyId: "company-1",
      userId: "user-1",
      token: "tok-abc",
      platform: "ANDROID",
    });
  });

  it("rejects an unknown platform", async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);

    const result = await registerPushDeviceAction({
      token: "tok-abc",
      platform: "WATCH" as never,
    });

    expect(result).toEqual({ ok: false, error: "Invalid device registration." });
    expect(registerPushDevice).not.toHaveBeenCalled();
  });

  it("rejects an empty token", async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);

    const result = await registerPushDeviceAction({
      token: "",
      platform: "IOS",
    });

    expect(result).toEqual({ ok: false, error: "Invalid device registration." });
  });

  it("fails for a user with no company", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      ...mockUser,
      companyId: null,
    } as never);

    const result = await registerPushDeviceAction({
      token: "tok-abc",
      platform: "ANDROID",
    });

    expect(result).toEqual({ ok: false, error: "No company affiliation." });
  });
});

describe("unregisterPushDeviceAction", () => {
  it("removes the token scoped to the current user", async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);

    const result = await unregisterPushDeviceAction("tok-abc");

    expect(result).toEqual({ ok: true });
    expect(unregisterPushDevice).toHaveBeenCalledWith({
      companyId: "company-1",
      userId: "user-1",
      token: "tok-abc",
    });
  });

  it("rejects a missing token", async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);

    const result = await unregisterPushDeviceAction("");

    expect(result).toEqual({ ok: false, error: "Missing device token." });
  });
});
