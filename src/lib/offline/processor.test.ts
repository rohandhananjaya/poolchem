import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "./db";
import { getDraft, saveDraft } from "./draft-visits";
import { computeNextRetryAt, MAX_RETRIES } from "./backoff";
import {
  enqueue,
  getByClientMutationId,
  getPending,
  markStatus,
} from "./mutation-queue";
import { _resetSweepGuardForTests, drainOnce } from "./processor";
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

let originalOnLine: PropertyDescriptor | undefined;

function setNavigatorOnline(online: boolean) {
  originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get: () => online,
  });
}

function restoreNavigatorOnline() {
  if (originalOnLine) {
    Object.defineProperty(navigator, "onLine", originalOnLine);
  } else {
    delete (navigator as { onLine?: boolean }).onLine;
  }
  originalOnLine = undefined;
}

describe("drainOnce", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    _resetSweepGuardForTests();
    // Deterministic backoff for assertions (jitter pinned to 0).
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreNavigatorOnline();
  });

  it("drains a pending entry, deleting the entry and its draft on success", async () => {
    const entry = await enqueue("company-1", "saveDraft", "visit-1", payload());
    await saveDraft("company-1", "tech-1", "visit-1", payload());

    const replay = vi.fn().mockResolvedValue(undefined);
    const results = await drainOnce("company-1", replay);

    expect(results).toEqual([
      { clientMutationId: entry.clientMutationId, status: "synced" },
    ]);
    expect(replay).toHaveBeenCalledTimes(1);
    expect(await getPending("company-1")).toHaveLength(0);
    await expect(getDraft("company-1", "visit-1")).resolves.toBeNull();
  });

  it("schedules a transient failure with backoff and does not retry before due", async () => {
    const entry = await enqueue("company-1", "saveDraft", "visit-1", payload());
    const now = 1_000_000;
    const replay = vi.fn().mockRejectedValue(new Error("offline"));

    const results = await drainOnce("company-1", replay, { now });

    expect(results).toEqual([
      { clientMutationId: entry.clientMutationId, status: "failed" },
    ]);
    const updated = await getByClientMutationId("company-1", entry.clientMutationId);
    expect(updated!.status).toBe("failed");
    expect(updated!.retryCount).toBe(1);
    expect(updated!.nextRetryAt).toBe(computeNextRetryAt(now, 0));

    // Not due yet → skipped.
    const beforeDue = vi.fn().mockResolvedValue(undefined);
    await expect(
      drainOnce("company-1", beforeDue, { now: updated!.nextRetryAt! - 1 }),
    ).resolves.toEqual([]);
    expect(beforeDue).not.toHaveBeenCalled();

    // Due → attempted again.
    const afterDue = vi.fn().mockResolvedValue(undefined);
    const retryResults = await drainOnce("company-1", afterDue, {
      now: updated!.nextRetryAt! + 1,
    });
    expect(retryResults).toEqual([
      { clientMutationId: entry.clientMutationId, status: "synced" },
    ]);
    expect(afterDue).toHaveBeenCalledTimes(1);
  });

  it("dead-letters a transient failure once the retry budget is exhausted", async () => {
    const entry = await enqueue("company-1", "saveDraft", "visit-1", payload());
    await markStatus("company-1", entry.clientMutationId, "pending", {
      retryCount: MAX_RETRIES,
    });
    const onDead = vi.fn();
    const replay = vi.fn().mockRejectedValue(new Error("flaky"));

    const results = await drainOnce("company-1", replay, { onDead });

    expect(results).toEqual([
      { clientMutationId: entry.clientMutationId, status: "dead" },
    ]);
    expect(onDead).toHaveBeenCalledWith(
      expect.objectContaining({ clientMutationId: entry.clientMutationId }),
    );
    expect(
      (await getByClientMutationId("company-1", entry.clientMutationId))!.status,
    ).toBe("dead");
  });

  it("dead-letters immediately when classifyError marks the failure permanent", async () => {
    const entry = await enqueue("company-1", "saveDraft", "visit-1", payload());
    const classifyError = vi.fn(() => true);
    const onDead = vi.fn();
    const replay = vi.fn().mockRejectedValue(new Error("Visit not found"));

    const results = await drainOnce("company-1", replay, {
      classifyError,
      onDead,
    });

    expect(results).toEqual([
      { clientMutationId: entry.clientMutationId, status: "dead" },
    ]);
    expect(onDead).toHaveBeenCalledTimes(1);
    expect(
      (await getByClientMutationId("company-1", entry.clientMutationId))!.status,
    ).toBe("dead");
  });

  it("keeps the draft while a failed sibling entry still holds unsynced edits", async () => {
    const first = await enqueue(
      "company-1",
      "saveDraft",
      "visit-1",
      payload({ clientMutationId: "mut-1" }),
    );
    await enqueue(
      "company-1",
      "saveDraft",
      "visit-1",
      payload({ clientMutationId: "mut-2" }),
    );
    await saveDraft(
      "company-1",
      "tech-1",
      "visit-1",
      payload({ clientMutationId: "mut-2" }),
    );

    const replay = vi.fn((e: { clientMutationId: string }) =>
      e.clientMutationId === first.clientMutationId
        ? Promise.resolve()
        : Promise.reject(new Error("offline")),
    );

    const results = await drainOnce("company-1", replay);

    expect(results.map((r) => r.status)).toEqual(["synced", "failed"]);
    // The newer (mut-2) payload is still unsynced → draft survives.
    const draft = await getDraft("company-1", "visit-1");
    expect(draft?.payload.clientMutationId).toBe("mut-2");
  });

  it("is a no-op while offline", async () => {
    await enqueue("company-1", "saveDraft", "visit-1", payload());
    setNavigatorOnline(false);

    const replay = vi.fn().mockResolvedValue(undefined);
    await expect(drainOnce("company-1", replay)).resolves.toEqual([]);
    expect(replay).not.toHaveBeenCalled();
  });

  it("skips overlapping sweeps (single-flight guard)", async () => {
    await enqueue("company-1", "saveDraft", "visit-1", payload());
    let resolveReplay: (value: void | PromiseLike<void>) => void = () => {};
    const replay = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveReplay = resolve;
        }),
    );

    const first = drainOnce("company-1", replay);
    const second = drainOnce("company-1", replay);

    // The second call returned synchronously (guard already set); let the first
    // sweep progress to the replay before resolving it.
    await vi.waitFor(() => expect(replay).toHaveBeenCalledTimes(1));
    resolveReplay(undefined);

    await expect(first).resolves.toHaveLength(1);
    await expect(second).resolves.toEqual([]);
  });

  it("keeps a draft replaced by a newer save while an older entry syncs", async () => {
    const first = payload({ clientMutationId: "mut-1", notes: "first save" });
    const entry = await enqueue("company-1", "saveDraft", "visit-1", first);
    await saveDraft("company-1", "tech-1", "visit-1", first);

    const newer = payload({ clientMutationId: "mut-2", notes: "second save" });
    const replay = vi.fn().mockImplementation(async () => {
      // A concurrent save overwrites the draft (and queues its own entry)
      // while the network round-trip for the first entry is outstanding.
      await saveDraft("company-1", "tech-1", "visit-1", newer);
      await enqueue("company-1", "saveDraft", "visit-1", newer);
    });

    const results = await drainOnce("company-1", replay);

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

  it("never persists a processing status, so a killed app recovers on reload", async () => {
    const entry = await enqueue("company-1", "saveDraft", "visit-1", payload());
    let resolveReplay: (value: void | PromiseLike<void>) => void = () => {};
    const replay = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveReplay = resolve;
        }),
    );

    const sweep = drainOnce("company-1", replay);
    await vi.waitFor(() => expect(replay).toHaveBeenCalledTimes(1));

    // Mid-replay the entry is still `pending` in IndexedDB — a reload (which
    // drops the in-memory in-flight set) would re-select and re-attempt it.
    const midFlight = await getByClientMutationId(
      "company-1",
      entry.clientMutationId,
    );
    expect(midFlight!.status).toBe("pending");

    resolveReplay(undefined);
    await expect(sweep).resolves.toHaveLength(1);
    await expect(
      getByClientMutationId("company-1", entry.clientMutationId),
    ).resolves.toBeNull();
  });

  it("fails an entry whose replay hangs and releases the sweep guard", async () => {
    const entry = await enqueue("company-1", "saveDraft", "visit-1", payload());
    const now = 1_000_000;
    const hung = vi.fn(() => new Promise(() => {}));

    const results = await drainOnce("company-1", hung, {
      now,
      replayTimeoutMs: 10,
    });

    expect(results).toEqual([
      { clientMutationId: entry.clientMutationId, status: "failed" },
    ]);
    const updated = await getByClientMutationId(
      "company-1",
      entry.clientMutationId,
    );
    expect(updated!.status).toBe("failed");
    expect(updated!.retryCount).toBe(1);

    // The single-flight guard was released: once the retry window elapses, a
    // fresh sweep proceeds.
    const followUp = vi.fn().mockResolvedValue(undefined);
    await expect(
      drainOnce("company-1", followUp, { now: updated!.nextRetryAt! + 1 }),
    ).resolves.toEqual([
      { clientMutationId: entry.clientMutationId, status: "synced" },
    ]);
    expect(followUp).toHaveBeenCalledTimes(1);
  });
});
