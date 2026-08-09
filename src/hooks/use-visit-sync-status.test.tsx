import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { db } from "@/lib/offline/db";
import { enqueue, markStatus } from "@/lib/offline/mutation-queue";
import { _resetSweepGuardForTests } from "@/lib/offline/processor";
import type { DraftVisitPayload } from "@/lib/offline/types";
import { useVisitSyncStatus } from "./use-visit-sync-status";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { toast } from "sonner";

const toastSuccess = vi.mocked(toast.success);
const toastError = vi.mocked(toast.error);

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

beforeEach(async () => {
  await db.delete();
  await db.open();
  _resetSweepGuardForTests();
  setNavigatorOnline(true);
  vi.clearAllMocks();
});

afterEach(() => {
  restoreNavigatorOnline();
  vi.restoreAllMocks();
});

describe("useVisitSyncStatus", () => {
  it("does not toast on mount when the queue is already empty", async () => {
    const replay = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useVisitSyncStatus({ companyId: "c1", visitId: "v1", replay }),
    );

    await waitFor(() => expect(result.current.status).toBe("synced"));

    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
    expect(replay).not.toHaveBeenCalled();
  });

  it("derives pending from a queued entry and fires the synced toast once it flushes", async () => {
    await enqueue("c1", "saveDraft", "v1", payload());
    const replay = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useVisitSyncStatus({ companyId: "c1", visitId: "v1", replay }),
    );

    // Mount drain flushes the queued entry through the injected replay.
    await waitFor(() => expect(replay).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(result.current.counts).toEqual({ pending: 0, failed: 0, dead: 0 }),
    );

    expect(result.current.status).toBe("synced");
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Changes synced"),
    );
  });

  it("reports offline while queued work waits for connectivity", async () => {
    await enqueue("c1", "saveDraft", "v1", payload());
    setNavigatorOnline(false);
    const replay = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useVisitSyncStatus({ companyId: "c1", visitId: "v1", replay }),
    );

    await waitFor(() => expect(result.current.status).toBe("offline"));
    expect(replay).not.toHaveBeenCalled();
  });

  it("fires an error toast when a queued entry dead-letters", async () => {
    await enqueue("c1", "saveDraft", "v1", payload());
    const replay = vi
      .fn()
      .mockRejectedValue(new Error("Visit not found"));

    const { result } = renderHook(() =>
      useVisitSyncStatus({ companyId: "c1", visitId: "v1", replay }),
    );

    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(result.current.counts.dead).toBeGreaterThan(0);
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Some changes couldn't be synced. Re-save or retry them.",
      ),
    );
  });

  it("fires a retry copy (not the dead-letter copy) for a transient failure", async () => {
    await enqueue("c1", "saveDraft", "v1", payload());
    const replay = vi.fn().mockRejectedValue(new Error("flaky"));

    const { result } = renderHook(() =>
      useVisitSyncStatus({ companyId: "c1", visitId: "v1", replay }),
    );

    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(result.current.counts.failed).toBeGreaterThan(0);
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Some changes couldn't be synced. Will retry automatically.",
      ),
    );
  });

  it("does not toast on mount when a dead-lettered entry already exists", async () => {
    const entry = await enqueue("c1", "saveDraft", "v1", payload());
    await markStatus("c1", entry.clientMutationId, "dead");

    const replay = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useVisitSyncStatus({ companyId: "c1", visitId: "v1", replay }),
    );

    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(result.current.counts.dead).toBe(1);
    // The dead entry predates this page load — surfacing it again as a fresh
    // failure would duplicate the badge's message.
    expect(toastError).not.toHaveBeenCalled();
  });

  it("forwards the replayed { version } to onReplayApplied (re-base)", async () => {
    await enqueue("c1", "saveDraft", "v1", payload());
    const onReplayApplied = vi.fn();
    const replay = vi.fn().mockResolvedValue({ version: 7 });

    const { result } = renderHook(() =>
      useVisitSyncStatus({
        companyId: "c1",
        visitId: "v1",
        replay,
        onReplayApplied,
      }),
    );

    await waitFor(() => expect(replay).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onReplayApplied).toHaveBeenCalledWith(7));
    await waitFor(() => expect(result.current.status).toBe("synced"));
  });

  it("does not call onReplayApplied when the replay result carries no version", async () => {
    await enqueue("c1", "saveDraft", "v1", payload());
    const onReplayApplied = vi.fn();
    const replay = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useVisitSyncStatus({
        companyId: "c1",
        visitId: "v1",
        replay,
        onReplayApplied,
      }),
    );

    await waitFor(() => expect(result.current.status).toBe("synced"));
    expect(onReplayApplied).not.toHaveBeenCalled();
  });

  it("derives status only from this visit's entries (drain is tenant-wide)", async () => {
    await enqueue("c1", "saveDraft", "v1", payload());
    await enqueue("c1", "saveDraft", "v2", payload());
    // v1 flushes; v2 fails transiently and stays queued (scheduled retry).
    const replay = vi.fn().mockImplementation((entry: { visitId: string }) =>
      entry.visitId === "v2"
        ? Promise.reject(new Error("flaky"))
        : Promise.resolve(),
    );

    const { result } = renderHook(() =>
      useVisitSyncStatus({ companyId: "c1", visitId: "v1", replay }),
    );

    // v1 synced cleanly even though v2 is still stuck in the same tenant queue.
    await waitFor(() => expect(result.current.status).toBe("synced"));
    expect(result.current.counts).toEqual({ pending: 0, failed: 0, dead: 0 });
    expect(
      await db.mutationQueue
        .where("companyId")
        .equals("c1")
        .filter((e) => e.visitId === "v2")
        .count(),
    ).toBe(1);
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Changes synced"),
    );
  });
});
