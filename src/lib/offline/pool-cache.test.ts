import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "./db";
import { clearPoolCache, getPoolCache, savePoolCache } from "./pool-cache";
import type { CachedPool } from "./types";

function pool(id: string): CachedPool {
  return {
    id,
    name: `Pool ${id}`,
    volume: 1000,
    address: null,
    homeownerEmail: null,
    homeownerPhone: null,
    notes: null,
    propertyId: null,
    propertyName: null,
    isActive: true,
    lastVisitAt: null,
  };
}

describe("pool-cache", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("runs against the v5 schema with a poolCache table", async () => {
    expect(db.verno).toBe(5);
  });

  it("returns null before a snapshot is saved", async () => {
    await expect(getPoolCache("company-1")).resolves.toBeNull();
  });

  it("stores and reads a snapshot per tenant", async () => {
    await savePoolCache("company-1", [pool("p1"), pool("p2")], 2);

    const snapshot = await getPoolCache("company-1");
    expect(snapshot).not.toBeNull();
    expect(snapshot!.companyId).toBe("company-1");
    expect(snapshot!.pools.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(snapshot!.total).toBe(2);
    expect(snapshot!.cachedAt).toBeGreaterThan(0);
  });

  it("overwrites the previous snapshot on a newer save", async () => {
    await savePoolCache("company-1", [pool("p1")], 1);
    await savePoolCache("company-1", [pool("p1"), pool("p2")], 2);

    const snapshot = await getPoolCache("company-1");
    expect(snapshot!.pools).toHaveLength(2);
    expect(snapshot!.total).toBe(2);
    expect(await db.poolCache.count()).toBe(1);
  });

  it("scopes snapshots per tenant", async () => {
    await savePoolCache("company-1", [pool("p1")], 1);
    await expect(getPoolCache("company-2")).resolves.toBeNull();

    await savePoolCache("company-2", [pool("p2")], 1);
    await expect(getPoolCache("company-1")).resolves.not.toBeNull();
    await expect(getPoolCache("company-2")).resolves.not.toBeNull();
  });

  it("clears a tenant's snapshot", async () => {
    await savePoolCache("company-1", [pool("p1")], 1);
    await clearPoolCache("company-1");
    await expect(getPoolCache("company-1")).resolves.toBeNull();
  });
});
