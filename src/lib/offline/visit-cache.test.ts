import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "./db";
import { clearVisitCache, getVisitCache, saveVisitCache } from "./visit-cache";
import type { CachedVisit } from "./types";

function visit(visitId: string, companyId: string): CachedVisit {
  return {
    visitId,
    companyId,
    pool: {
      id: `pool-${visitId}`,
      name: "Pool One",
      address: "1 Main St",
      volume: 15000,
      image: null,
    },
    status: "IN_PROGRESS",
    cancellationReason: null,
    scheduledAt: "2026-08-09T12:00:00.000Z",
    lastReadings: { ph: 7.4, freeChlorine: 2.5, temperature: 84 },
    chemicals: [{ name: "Chlorine", amount: 2, unit: "lb" }],
    notes: "check pump",
    cachedAt: 1234,
  };
}

describe("visit-cache", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("runs against the v6 schema with a visitCache table", async () => {
    expect(db.verno).toBe(6);
  });

  it("returns null before a snapshot is saved", async () => {
    await expect(getVisitCache("company-1", "visit-1")).resolves.toBeNull();
  });

  it("stores and reads a snapshot per (tenant, visit)", async () => {
    await saveVisitCache(visit("visit-1", "company-1"));

    const snapshot = await getVisitCache("company-1", "visit-1");
    expect(snapshot).not.toBeNull();
    expect(snapshot!.visitId).toBe("visit-1");
    expect(snapshot!.companyId).toBe("company-1");
    expect(snapshot!.pool.name).toBe("Pool One");
    expect(snapshot!.status).toBe("IN_PROGRESS");
    expect(snapshot!.lastReadings!.ph).toBe(7.4);
    expect(await db.visitCache.count()).toBe(1);
  });

  it("overwrites the previous snapshot on a newer save of the same visit", async () => {
    await saveVisitCache(visit("visit-1", "company-1"));
    await saveVisitCache({ ...visit("visit-1", "company-1"), notes: "updated" });

    const snapshot = await getVisitCache("company-1", "visit-1");
    expect(snapshot!.notes).toBe("updated");
    expect(await db.visitCache.count()).toBe(1);
  });

  it("scopes snapshots per tenant and per visit", async () => {
    await saveVisitCache(visit("visit-1", "company-1"));

    await expect(getVisitCache("company-2", "visit-1")).resolves.toBeNull();
    await expect(getVisitCache("company-1", "visit-2")).resolves.toBeNull();

    await saveVisitCache(visit("visit-2", "company-1"));
    await expect(getVisitCache("company-1", "visit-1")).resolves.not.toBeNull();
    await expect(getVisitCache("company-1", "visit-2")).resolves.not.toBeNull();
  });

  it("clears a single (tenant, visit) snapshot without touching others", async () => {
    await saveVisitCache(visit("visit-1", "company-1"));
    await saveVisitCache(visit("visit-2", "company-1"));

    await clearVisitCache("company-1", "visit-1");

    await expect(getVisitCache("company-1", "visit-1")).resolves.toBeNull();
    await expect(getVisitCache("company-1", "visit-2")).resolves.not.toBeNull();
  });
});
