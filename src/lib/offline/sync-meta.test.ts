import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "./db";
import { getLastSyncedAt, setLastSyncedAt } from "./sync-meta";

describe("sync-meta", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("runs against the v5 schema with syncMeta, poolCache, and visitCache tables", async () => {
    expect(db.verno).toBe(5);
    await setLastSyncedAt("c1", 1234);
    await expect(db.syncMeta.count()).resolves.toBe(1);
  });

  it("returns null before the tenant has synced", async () => {
    await expect(getLastSyncedAt("c1")).resolves.toBeNull();
  });

  it("stores and reads a lastSyncedAt bookmark", async () => {
    await setLastSyncedAt("c1", 1000);
    await expect(getLastSyncedAt("c1")).resolves.toBe(1000);
  });

  it("overwrites the bookmark on a newer sync", async () => {
    await setLastSyncedAt("c1", 1000);
    await setLastSyncedAt("c1", 2000);
    await expect(getLastSyncedAt("c1")).resolves.toBe(2000);
    await expect(db.syncMeta.count()).resolves.toBe(1);
  });

  it("defaults to now when no timestamp is given", async () => {
    const before = Date.now();
    await setLastSyncedAt("c1");
    const at = await getLastSyncedAt("c1");
    expect(at).not.toBeNull();
    expect(at as number).toBeGreaterThanOrEqual(before);
    expect(at as number).toBeLessThanOrEqual(Date.now());
  });

  it("scopes bookmarks per tenant", async () => {
    await setLastSyncedAt("c1", 1000);
    await expect(getLastSyncedAt("c2")).resolves.toBeNull();
    await setLastSyncedAt("c2", 2000);
    await expect(getLastSyncedAt("c1")).resolves.toBe(1000);
    await expect(getLastSyncedAt("c2")).resolves.toBe(2000);
  });
});
