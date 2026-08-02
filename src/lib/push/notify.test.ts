import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/push-devices", () => ({
  getPushDevicesForUser: vi.fn(),
}));
vi.mock("@/lib/db/visits", () => ({
  getVisitById: vi.fn(),
}));
vi.mock("./index", () => ({
  sendPush: vi.fn(),
}));

const { getPushDevicesForUser } = await import("@/lib/db/push-devices");
const { getVisitById } = await import("@/lib/db/visits");
const { sendPush } = await import("./index");
const { notifyVisitAssigned } = await import("./notify");

const companyId = "company-1";
const visitId = "visit-1";
const techId = "user-1";

const mockVisit = {
  id: visitId,
  pool: { id: "pool-1", name: "Test Pool", address: "123 Pool St" },
};

const mockDevices = [
  { id: "device-1", token: "tok-android", platform: "ANDROID" },
  { id: "device-2", token: "tok-ios", platform: "IOS" },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("notifyVisitAssigned", () => {
  it("sends to every registered device with a visit payload", async () => {
    vi.mocked(getVisitById).mockResolvedValue(mockVisit as never);
    vi.mocked(getPushDevicesForUser).mockResolvedValue(mockDevices as never);

    await notifyVisitAssigned({ companyId, visitId, techId });

    expect(getVisitById).toHaveBeenCalledWith(visitId, companyId);
    expect(getPushDevicesForUser).toHaveBeenCalledWith(companyId, techId);
    expect(sendPush).toHaveBeenCalledTimes(2);
    expect(sendPush).toHaveBeenCalledWith(
      { token: "tok-android", platform: "ANDROID" },
      {
        title: "New visit assigned",
        body: "Test Pool — 123 Pool St",
        data: { visitId, poolId: "pool-1" },
      },
    );
    expect(sendPush).toHaveBeenCalledWith(
      { token: "tok-ios", platform: "IOS" },
      {
        title: "New visit assigned",
        body: "Test Pool — 123 Pool St",
        data: { visitId, poolId: "pool-1" },
      },
    );
  });

  it("no-ops when no tech is assigned", async () => {
    await notifyVisitAssigned({ companyId, visitId, techId: null });

    expect(getVisitById).not.toHaveBeenCalled();
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("no-ops when the assignee is unchanged", async () => {
    await notifyVisitAssigned({
      companyId,
      visitId,
      techId,
      previousTechId: techId,
    });

    expect(getVisitById).not.toHaveBeenCalled();
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("no-ops when the visit is not found", async () => {
    vi.mocked(getVisitById).mockResolvedValue(null);
    vi.mocked(getPushDevicesForUser).mockResolvedValue(mockDevices as never);

    await notifyVisitAssigned({ companyId, visitId, techId });

    expect(sendPush).not.toHaveBeenCalled();
  });

  it("no-ops when the tech has no registered devices", async () => {
    vi.mocked(getVisitById).mockResolvedValue(mockVisit as never);
    vi.mocked(getPushDevicesForUser).mockResolvedValue([]);

    await notifyVisitAssigned({ companyId, visitId, techId });

    expect(sendPush).not.toHaveBeenCalled();
  });

  it("omits the address from the body when the pool has none", async () => {
    vi.mocked(getVisitById).mockResolvedValue({
      id: visitId,
      pool: { id: "pool-1", name: "Test Pool", address: null },
    } as never);
    vi.mocked(getPushDevicesForUser).mockResolvedValue(mockDevices as never);

    await notifyVisitAssigned({ companyId, visitId, techId });

    expect(sendPush).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ body: "Test Pool" }),
    );
  });
});
