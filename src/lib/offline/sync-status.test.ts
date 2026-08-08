import { describe, expect, it } from "vitest";

import { deriveSyncStatus, SYNC_STATUS_META } from "./sync-status";
import type { VisitSyncStats } from "./sync-status";

function stats(overrides: Partial<VisitSyncStats> = {}): VisitSyncStats {
  return { pending: 0, failed: 0, dead: 0, ...overrides };
}

describe("deriveSyncStatus", () => {
  it("reports synced when nothing is queued", () => {
    expect(deriveSyncStatus(stats(), { online: true, inFlight: false })).toBe(
      "synced",
    );
    expect(deriveSyncStatus(stats(), { online: false, inFlight: false })).toBe(
      "synced",
    );
  });

  it("reports synced even while a sweep runs if nothing is pending", () => {
    expect(deriveSyncStatus(stats(), { online: true, inFlight: true })).toBe(
      "synced",
    );
  });

  it("reports offline for queued work while offline", () => {
    expect(
      deriveSyncStatus(stats({ pending: 2 }), {
        online: false,
        inFlight: false,
      }),
    ).toBe("offline");
  });

  it("reports pending for queued work while online", () => {
    expect(
      deriveSyncStatus(stats({ pending: 2 }), { online: true, inFlight: false }),
    ).toBe("pending");
  });

  it("reports syncing when a sweep is in flight and work is pending", () => {
    expect(
      deriveSyncStatus(stats({ pending: 1 }), { online: true, inFlight: true }),
    ).toBe("syncing");
  });

  it("failed outranks syncing, pending and offline", () => {
    expect(
      deriveSyncStatus(stats({ pending: 1, failed: 1 }), {
        online: true,
        inFlight: true,
      }),
    ).toBe("failed");
    expect(
      deriveSyncStatus(stats({ pending: 1, failed: 1 }), {
        online: false,
        inFlight: false,
      }),
    ).toBe("failed");
  });

  it("dead-lettered entries report failed", () => {
    expect(
      deriveSyncStatus(stats({ dead: 1 }), { online: true, inFlight: false }),
    ).toBe("failed");
    expect(
      deriveSyncStatus(stats({ pending: 3, dead: 2 }), {
        online: true,
        inFlight: true,
      }),
    ).toBe("failed");
  });

  it("pending outranks offline for queued work while online", () => {
    expect(
      deriveSyncStatus(stats({ pending: 1 }), { online: true, inFlight: false }),
    ).toBe("pending");
  });

  it("syncing outranks pending for queued work during a sweep", () => {
    expect(
      deriveSyncStatus(stats({ pending: 1 }), { online: true, inFlight: true }),
    ).toBe("syncing");
  });
});

describe("SYNC_STATUS_META", () => {
  it("covers every status with a label and a tone", () => {
    const statuses = ["offline", "pending", "syncing", "failed", "synced"] as const;
    for (const status of statuses) {
      expect(SYNC_STATUS_META[status].label).toBeTruthy();
      expect(SYNC_STATUS_META[status].tone).toBeTruthy();
    }
  });
});
