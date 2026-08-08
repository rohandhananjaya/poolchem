import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "./db";
import { saveDraft } from "./draft-visits";
import {
  clearCompanyData,
  countEntriesForVisit,
  deleteDeadForVisit,
  enqueue,
  getByClientMutationId,
  getDead,
  getDeadForVisit,
  getDue,
  getPending,
  getStats,
  markStatus,
  retryDead,
} from "./mutation-queue";
import type { DraftVisitPayload } from "./types";

function payload(overrides: Partial<DraftVisitPayload> = {}): DraftVisitPayload {
  return {
    readings: {
      ph: 7.2,
      freeChlorine: 1.5,
      totalAlkalinity: 90,
      calciumHardness: 250,
      cyanuricAcid: 30,
      temperature: 78,
    },
    chemicals: [],
    notes: "offline save",
    ...overrides,
  };
}

describe("mutation-queue", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("enqueues a mutation as pending with a minted clientMutationId", async () => {
    const entry = await enqueue("company-1", "saveDraft", "visit-1", payload());

    expect(entry.status).toBe("pending");
    expect(entry.retryCount).toBe(0);
    expect(entry.clientMutationId).toBeTruthy();
    expect(entry.action).toBe("saveDraft");
    expect(entry.visitId).toBe("visit-1");
  });

  it("reuses the payload's clientMutationId when present", async () => {
    const entry = await enqueue(
      "company-1",
      "saveDraft",
      "visit-1",
      payload({ clientMutationId: "form-minted-key" }),
    );

    expect(entry.clientMutationId).toBe("form-minted-key");
  });

  it("drops a re-enqueued mutation with the same clientMutationId", async () => {
    await enqueue(
      "company-1",
      "saveDraft",
      "visit-1",
      payload({ clientMutationId: "dup-key" }),
    );
    await enqueue(
      "company-1",
      "saveDraft",
      "visit-1",
      payload({ clientMutationId: "dup-key", notes: "second attempt" }),
    );

    const rows = await db.mutationQueue
      .where("companyId")
      .equals("company-1")
      .toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].payload.notes).toBe("offline save");
  });

  it("getPending returns entries oldest-first", async () => {
    await enqueue("company-1", "saveDraft", "visit-1", payload());
    await enqueue("company-1", "completeVisit", "visit-1", payload());
    await enqueue("company-1", "saveDraft", "visit-2", payload());

    const pending = await getPending("company-1");
    expect(pending.map((e) => e.clientMutationId)).toEqual([
      expect.any(String),
      expect.any(String),
      expect.any(String),
    ]);
    // createdAt must be non-decreasing (FIFO).
    const times = pending.map((e) => e.createdAt);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("getPending honors a limit", async () => {
    await enqueue("company-1", "saveDraft", "visit-1", payload());
    await enqueue("company-1", "saveDraft", "visit-2", payload());

    const batch = await getPending("company-1", 1);
    expect(batch).toHaveLength(1);
  });

  it("getPending ignores entries from other tenants", async () => {
    await enqueue("company-1", "saveDraft", "visit-1", payload());
    await enqueue("company-2", "saveDraft", "visit-9", payload());

    const pending = await getPending("company-1");
    expect(pending).toHaveLength(1);
    expect(pending[0].companyId).toBe("company-1");
  });

  it("getPending excludes non-pending entries", async () => {
    await enqueue("company-1", "saveDraft", "visit-1", payload());
    const done = await enqueue("company-1", "saveDraft", "visit-2", payload());
    await markStatus("company-1", done.clientMutationId, "processing");

    const pending = await getPending("company-1");
    expect(pending.map((e) => e.clientMutationId)).not.toContain(
      done.clientMutationId,
    );
  });

  it("getByClientMutationId returns the entry or null", async () => {
    const entry = await enqueue(
      "company-1",
      "saveDraft",
      "visit-1",
      payload({ clientMutationId: "known-key" }),
    );

    const found = await getByClientMutationId("company-1", "known-key");
    expect(found!.id).toBe(entry.id);

    await expect(getByClientMutationId("company-1", "nope")).resolves.toBeNull();
  });

  it("markStatus flips status and records diagnostics", async () => {
    const entry = await enqueue("company-1", "saveDraft", "visit-1", payload());

    await markStatus("company-1", entry.clientMutationId, "failed", {
      retryCount: 1,
      lastError: "offline",
    });

    const updated = await getByClientMutationId("company-1", entry.clientMutationId);
    expect(updated!.status).toBe("failed");
    expect(updated!.retryCount).toBe(1);
    expect(updated!.lastError).toBe("offline");
  });

  it("markStatus without diagnostics leaves them untouched", async () => {
    const entry = await enqueue("company-1", "saveDraft", "visit-1", payload());
    await markStatus("company-1", entry.clientMutationId, "processing");

    const updated = await getByClientMutationId("company-1", entry.clientMutationId);
    expect(updated!.status).toBe("processing");
    expect(updated!.lastError).toBeUndefined();
  });

  it("clearCompanyData wipes drafts and queue for one tenant only", async () => {
    await saveDraft("company-1", "tech-1", "visit-1", payload());
    await saveDraft("company-2", "tech-9", "visit-2", payload());
    await enqueue("company-1", "saveDraft", "visit-1", payload());
    await enqueue("company-2", "saveDraft", "visit-2", payload());

    await clearCompanyData("company-1");

    expect(await db.draftVisits.where("companyId").equals("company-1").count()).toBe(0);
    expect(
      await db.mutationQueue.where("companyId").equals("company-1").count(),
    ).toBe(0);
    expect(await db.draftVisits.where("companyId").equals("company-2").count()).toBe(1);
    expect(
      await db.mutationQueue.where("companyId").equals("company-2").count(),
    ).toBe(1);
  });
});

describe("queue sweeps and dead-letter state", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("getDue returns pending entries plus failed entries past their retry window", async () => {
    const now = 1_000_000;
    await enqueue("company-1", "saveDraft", "visit-1", payload());
    await enqueue("company-1", "saveDraft", "visit-2", payload());
    const due = await enqueue("company-1", "saveDraft", "visit-3", payload());
    await markStatus("company-1", due.clientMutationId, "failed", {
      retryCount: 1,
      nextRetryAt: now - 1,
    });
    const waiting = await enqueue("company-1", "saveDraft", "visit-4", payload());
    await markStatus("company-1", waiting.clientMutationId, "failed", {
      retryCount: 2,
      nextRetryAt: now + 1000,
    });
    const dead = await enqueue("company-1", "saveDraft", "visit-5", payload());
    await markStatus("company-1", dead.clientMutationId, "dead");

    const dueEntries = await getDue("company-1", { now });
    const ids = dueEntries.map((e) => e.clientMutationId);
    expect(ids).toHaveLength(3);
    expect(ids).not.toContain(waiting.clientMutationId);
    expect(ids).not.toContain(dead.clientMutationId);

    const limited = await getDue("company-1", { now, limit: 1 });
    expect(limited).toHaveLength(1);
  });

  it("getDue excludes other tenants", async () => {
    await enqueue("company-1", "saveDraft", "visit-1", payload());
    await enqueue("company-2", "saveDraft", "visit-9", payload());

    const due = await getDue("company-1");
    expect(due).toHaveLength(1);
    expect(due[0].companyId).toBe("company-1");
  });

  it("getDead/getDeadForVisit list dead entries and deleteDeadForVisit removes only a visit's", async () => {
    const v1 = await enqueue("company-1", "saveDraft", "visit-1", payload());
    await markStatus("company-1", v1.clientMutationId, "dead");
    const v2 = await enqueue("company-1", "saveDraft", "visit-2", payload());
    await markStatus("company-1", v2.clientMutationId, "dead");
    await enqueue("company-1", "saveDraft", "visit-3", payload());

    expect(await getDead("company-1")).toHaveLength(2);
    expect(await getDeadForVisit("company-1", "visit-1")).toHaveLength(1);

    await deleteDeadForVisit("company-1", "visit-1");

    expect(await getDead("company-1")).toHaveLength(1);
    expect(await getDeadForVisit("company-1", "visit-2")).toHaveLength(1);
    // The pending entry and other tenant's data are untouched.
    expect(await getPending("company-1")).toHaveLength(1);
  });

  it("retryDead resets a visit's dead entries to pending with a cleared budget", async () => {
    const v1 = await enqueue("company-1", "saveDraft", "visit-1", payload());
    await markStatus("company-1", v1.clientMutationId, "dead", {
      retryCount: 6,
      lastError: "boom",
      nextRetryAt: 123,
    });
    const v2 = await enqueue("company-1", "saveDraft", "visit-2", payload());
    await markStatus("company-1", v2.clientMutationId, "dead");

    await retryDead("company-1", "visit-1");

    const retried = await getByClientMutationId("company-1", v1.clientMutationId);
    expect(retried!.status).toBe("pending");
    expect(retried!.retryCount).toBe(0);
    expect(retried!.nextRetryAt).toBeUndefined();
    expect(retried!.lastError).toBeUndefined();
    // Other visits' dead entries stay dead.
    expect(
      (await getByClientMutationId("company-1", v2.clientMutationId))!.status,
    ).toBe("dead");
  });

  it("countEntriesForVisit counts every entry for a visit regardless of status", async () => {
    const a = await enqueue("company-1", "saveDraft", "visit-1", payload());
    const b = await enqueue("company-1", "saveDraft", "visit-1", payload());
    await markStatus("company-1", a.clientMutationId, "failed");
    await markStatus("company-1", b.clientMutationId, "dead");
    await enqueue("company-1", "saveDraft", "visit-2", payload());

    expect(await countEntriesForVisit("company-1", "visit-1")).toBe(2);
    expect(await countEntriesForVisit("company-1", "visit-2")).toBe(1);
    expect(await countEntriesForVisit("company-2", "visit-1")).toBe(0);
  });

  it("getStats counts every status including processing", async () => {
    const a = await enqueue("company-1", "saveDraft", "visit-1", payload());
    const b = await enqueue("company-1", "saveDraft", "visit-2", payload());
    await markStatus("company-1", a.clientMutationId, "failed");
    await markStatus("company-1", b.clientMutationId, "dead");
    await enqueue("company-1", "saveDraft", "visit-3", payload());

    expect(await getStats("company-1")).toEqual({
      pending: 1,
      processing: 0,
      failed: 1,
      dead: 1,
    });
  });
});
