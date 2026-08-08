import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "./db";
import { saveDraft } from "./draft-visits";
import {
  clearCompanyData,
  enqueue,
  getByClientMutationId,
  getPending,
  markStatus,
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
