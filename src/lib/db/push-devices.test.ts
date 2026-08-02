import { describe, expect, it, beforeEach, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const {
  registerPushDevice,
  unregisterPushDevice,
  getPushDevicesForUser,
} = await import("@/lib/db/push-devices");

const companyId = "company-1";
const userId = "user-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registerPushDevice", () => {
  it("creates a device row for a new token", async () => {
    prismaMock.pushDevice.upsert.mockResolvedValue({ id: "device-1" });

    await registerPushDevice({
      companyId,
      userId,
      platform: "ANDROID",
      token: "tok-abc",
    });

    expect(prismaMock.pushDevice.upsert).toHaveBeenCalledWith({
      where: { token: "tok-abc" },
      update: { userId, companyId, platform: "ANDROID" },
      create: { userId, companyId, platform: "ANDROID", token: "tok-abc" },
    });
  });

  it("reassigns an existing token to its new owner", async () => {
    prismaMock.pushDevice.upsert.mockResolvedValue({ id: "device-1" });

    await registerPushDevice({
      companyId,
      userId: "user-2",
      platform: "IOS",
      token: "tok-abc",
    });

    expect(prismaMock.pushDevice.upsert).toHaveBeenCalledWith({
      where: { token: "tok-abc" },
      update: { userId: "user-2", companyId, platform: "IOS" },
      create: { userId: "user-2", companyId, platform: "IOS", token: "tok-abc" },
    });
  });
});

describe("unregisterPushDevice", () => {
  it("deletes the device scoped to company + user", async () => {
    prismaMock.pushDevice.deleteMany.mockResolvedValue({ count: 1 });

    const count = await unregisterPushDevice({
      companyId,
      userId,
      token: "tok-abc",
    });

    expect(count).toBe(1);
    expect(prismaMock.pushDevice.deleteMany).toHaveBeenCalledWith({
      where: { token: "tok-abc", companyId, userId },
    });
  });

  it("returns 0 when no matching device exists", async () => {
    prismaMock.pushDevice.deleteMany.mockResolvedValue({ count: 0 });

    const count = await unregisterPushDevice({
      companyId,
      userId,
      token: "tok-missing",
    });

    expect(count).toBe(0);
  });
});

describe("getPushDevicesForUser", () => {
  it("returns the user's devices within the company", async () => {
    const devices = [{ id: "device-1", token: "tok-abc" }];
    prismaMock.pushDevice.findMany.mockResolvedValue(devices);

    const result = await getPushDevicesForUser(companyId, userId);

    expect(result).toEqual(devices);
    expect(prismaMock.pushDevice.findMany).toHaveBeenCalledWith({
      where: { companyId, userId },
      orderBy: { createdAt: "asc" },
    });
  });
});
