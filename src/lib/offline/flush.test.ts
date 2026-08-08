import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "./db";
import { getDraft, saveDraft } from "./draft-visits";
import { flushPending, type FlushReplay } from "./flush";
import { enqueue, getPending } from "./mutation-queue";
import type { DraftVisitPayload, QueuedMutation } from "./types";

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

describe("flushPending", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("replays each pending entry and deletes the entry and its draft on success", async () => {
    const entry = await enqueue(
      "company-1",
      "saveDraft",
      "visit-1",
      payload(),
    );
    await saveDraft("company-1", "tech-1", "visit-1", payload());

    const replay = vi.fn().mockResolvedValue(undefined) as FlushReplay;
    const results = await flushPending("company-1", replay);

    expect(replay).toHaveBeenCalledTimes(1);
    expect(replay).toHaveBeenCalledWith(expect.objectContaining({ id: entry.id }));
    expect(results).toEqual([
      { clientMutationId: entry.clientMutationId, status: "synced" },
    ]);
    expect(await getPending("company-1")).toHaveLength(0);
    await expect(getDraft("company-1", "visit-1")).resolves.toBeNull();
  });

  it("leaves a failed entry pending and keeps its draft", async () => {
    const entry = await enqueue(
      "company-1",
      "saveDraft",
      "visit-1",
      payload(),
    );
    await saveDraft("company-1", "tech-1", "visit-1", payload());

    const replay = vi.fn().mockRejectedValue(new Error("offline")) as FlushReplay;
    const results = await flushPending("company-1", replay);

    expect(results).toEqual([
      { clientMutationId: entry.clientMutationId, status: "failed" },
    ]);
    const pending = await getPending("company-1");
    expect(pending).toHaveLength(1);
    expect(pending[0].clientMutationId).toBe(entry.clientMutationId);
    expect(await getDraft("company-1", "visit-1")).not.toBeNull();
  });

  it("keeps a draft replaced by a newer save while the flush was in flight", async () => {
    const first = payload({ clientMutationId: "mut-1", notes: "first save" });
    const entry = await enqueue("company-1", "saveDraft", "visit-1", first);
    await saveDraft("company-1", "tech-1", "visit-1", first);

    const newer = payload({ clientMutationId: "mut-2", notes: "second save" });
    const replay = vi
      .fn()
      .mockImplementation(async () => {
        // A concurrent save overwrites the draft (and queues its own entry)
        // while the network round-trip for the first entry is outstanding.
        await saveDraft("company-1", "tech-1", "visit-1", newer);
        await enqueue("company-1", "saveDraft", "visit-1", newer);
      }) as FlushReplay;

    const results = await flushPending("company-1", replay);

    expect(results).toEqual([
      { clientMutationId: entry.clientMutationId, status: "synced" },
    ]);
    // The newer draft must survive even though the older entry synced.
    const draft = await getDraft("company-1", "visit-1");
    expect(draft?.payload.clientMutationId).toBe("mut-2");
    // The synced entry is gone; the newer one still awaits replay.
    expect((await getPending("company-1")).map((e) => e.clientMutationId)).toEqual([
      "mut-2",
    ]);
  });

  it("continues past a failed entry and flushes the rest", async () => {
    const first = await enqueue("company-1", "saveDraft", "visit-1", payload());
    const second = await enqueue("company-1", "saveDraft", "visit-2", payload());

    const replay = vi
      .fn()
      .mockImplementation((e: QueuedMutation) =>
        e.clientMutationId === first.clientMutationId
          ? Promise.reject(new Error("offline"))
          : Promise.resolve(),
      ) as FlushReplay;
    const results = await flushPending("company-1", replay);

    expect(results).toEqual([
      { clientMutationId: first.clientMutationId, status: "failed" },
      { clientMutationId: second.clientMutationId, status: "synced" },
    ]);
    const pending = await getPending("company-1");
    expect(pending.map((e) => e.clientMutationId)).toEqual([
      first.clientMutationId,
    ]);
  });

  it("honors the limit and only flushes that many entries", async () => {
    await enqueue("company-1", "saveDraft", "visit-1", payload());
    await enqueue("company-1", "saveDraft", "visit-2", payload());

    const replay = vi.fn().mockResolvedValue(undefined) as FlushReplay;
    const results = await flushPending("company-1", replay, { limit: 1 });

    expect(results).toHaveLength(1);
    expect(replay).toHaveBeenCalledTimes(1);
    expect(await getPending("company-1")).toHaveLength(1);
  });

  it("does not touch other tenants' entries", async () => {
    await enqueue("company-1", "saveDraft", "visit-1", payload());
    const other = await enqueue("company-2", "saveDraft", "visit-9", payload());

    const replay = vi.fn().mockResolvedValue(undefined) as FlushReplay;
    await flushPending("company-1", replay);

    expect(replay).toHaveBeenCalledTimes(1);
    expect(await getPending("company-2")).toHaveLength(1);
    expect((await getPending("company-2"))[0].clientMutationId).toBe(
      other.clientMutationId,
    );
  });

  it("is a no-op when there is nothing pending", async () => {
    const replay = vi.fn().mockResolvedValue(undefined) as FlushReplay;
    await expect(flushPending("company-1", replay)).resolves.toEqual([]);
    expect(replay).not.toHaveBeenCalled();
  });
});
