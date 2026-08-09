"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod/v4";
import { toast } from "sonner";

import { ERROR_MESSAGES } from "@/lib/errors";
import { getVisitStats, retryDead } from "@/lib/offline/mutation-queue";
import {
  deriveSyncStatus,
  type SyncStatus,
  type VisitSyncStats,
} from "@/lib/offline/sync-status";
import type { QueuedMutation } from "@/lib/offline/types";
import { useOnlineStatus } from "./use-online-status";
import { useQueueProcessor } from "./use-queue-processor";

/** Existing copy for a permanently-failed (dead-lettered) sync. */
const UNSYNCED_COPY = "Some changes couldn't be synced. Re-save or retry them.";

/** Copy for a transient failure the backoff sweep retries automatically. */
const RETRYING_COPY =
  "Some changes couldn't be synced. Will retry automatically.";

/** Default replay wiring: replay a queued mutation against the visit's saveDraftAction. */
async function saveDraftActionReplay(
  entry: QueuedMutation,
): Promise<unknown> {
  // Lazy import keeps the server-action module out of the hook's module graph —
  // tests inject their own `replay` and never load it.
  const { saveDraftAction } = await import(
    "@/app/(dashboard)/visits/[visitId]/actions"
  );
  return saveDraftAction(entry.visitId, entry.payload);
}

const DEFAULT_REPLAY: (entry: QueuedMutation) => Promise<unknown> =
  saveDraftActionReplay;

export interface UseVisitSyncStatusOptions {
  companyId: string;
  visitId: string;
  /**
   * Replays a queued mutation against its Server Action. Defaults to wiring
   * `saveDraftAction`; injectable for tests.
   */
  replay?: (entry: QueuedMutation) => Promise<unknown>;
  /**
   * Maps replay errors to permanent (dead-letter immediately instead of
   * burning retries). Defaults to the form's mapping: zod validation errors and
   * access errors (deleted visit, other tech's visit, completed/cancelled) can
   * never succeed on retry.
   */
  classifyError?: (err: unknown, entry: QueuedMutation) => boolean;
  /**
   * When `false` the processor is dormant and the badge is derived from
   * whatever counts remain (completed/other-tech pages). Default `true`.
   */
  enabled?: boolean;
  /**
   * Fired after a successful replay with the server's fresh `version` for the
   * visit. The form re-bases its known revision from this so a later completion
   * isn't falsely rejected as a conflict after its own save bumped the version.
   */
  onReplayApplied?: (version: number | undefined) => void;
}

export interface UseVisitSyncStatusResult {
  /** Derived sync state for this visit. */
  status: SyncStatus;
  /** Per-visit queue counts (`pending`, `failed`, `dead`). */
  counts: VisitSyncStats;
  /** Whether a tenant-wide queue sweep is in flight. */
  inFlight: boolean;
  /** Runs an immediate sweep (and refreshes counts after). */
  drain: () => Promise<unknown>;
  /** Resets this visit's dead entries and sweeps immediately. */
  retry: () => Promise<void>;
}

/** Default permanent-failure classification (mirrors the visit form's old one). */
export function classifyVisitError(err: unknown): boolean {
  if (err instanceof z.ZodError) return true;
  if (err instanceof Error) {
    const msg = err.message;
    // Server Action failures arrive serialized, so match on message rather
    // than instance: a deleted visit, one claimed by another tech, or a
    // completed/cancelled visit will never succeed on retry.
    if (msg.includes("Visit not found")) return true;
    if (msg.includes("in progress by another tech")) return true;
    if (msg.includes("completed or cancelled")) return true;
    // Serialized zod validation error (readingsSchema.parse rejection).
    if (msg.trim().startsWith("[") && msg.includes('"path"')) return true;
  }
  return false;
}

/**
 * Composes the queue processor with per-visit sync-status for the visit form:
 * keeps this visit's queue counts, derives the `SyncStatus` badge state from
 * `{online, inFlight}`, and fires deduped sonner toasts on the meaningful
 * transitions (a sync that fails, and all unsynced work clearing while online).
 *
 * The dead-letter retry chip's CTA is `retry()` — `retryDead` + an immediate
 * drain — replacing the form's old `handleRetryDead`.
 */
export function useVisitSyncStatus(
  options: UseVisitSyncStatusOptions,
): UseVisitSyncStatusResult {
  const { companyId, visitId, enabled = true } = options;
  const { online } = useOnlineStatus();

  // Latest-value refs so the replay wrapper (stable identity) always calls the
  // current underlying replay and forwards to the current onReplayApplied.
  const replayRef = useRef(options.replay ?? DEFAULT_REPLAY);
  const onReplayAppliedRef = useRef(options.onReplayApplied);
  useEffect(() => {
    replayRef.current = options.replay ?? DEFAULT_REPLAY;
    onReplayAppliedRef.current = options.onReplayApplied;
  }, [options.replay, options.onReplayApplied]);

  /**
   * Wraps the injected replay so the fresh `{ version }` each successful
   * saveDraft replay returns is surfaced to `onReplayApplied` (the form's
   * re-base hook). No processor change needed — the capture happens inside the
   * replay closure.
   */
  const replayWithVersionCapture = useCallback(async (entry: QueuedMutation) => {
    const result = await replayRef.current(entry);
    // Server Actions serialize their return value; saveDraftAction returns
    // `{ version }` on every applied write or replay.
    if (result && typeof result === "object" && "version" in result) {
      onReplayAppliedRef.current?.((result as { version?: number }).version);
    }
    return result;
  }, []);

  const [counts, setCounts] = useState<VisitSyncStats>({
    pending: 0,
    failed: 0,
    dead: 0,
  });
  const prevCountsRef = useRef<VisitSyncStats>({ pending: 0, failed: 0, dead: 0 });

  const refreshCounts = useCallback(async () => {
    const next = await getVisitStats(companyId, visitId);
    setCounts(next);
  }, [companyId, visitId]);

  // Toast transitions based on count changes — the single dedup point, so
  // sweeps/renders can't spam. Runs after every refresh.
  useEffect(() => {
    const prev = prevCountsRef.current;
    prevCountsRef.current = counts;
    const wasDirty = prev.pending + prev.failed + prev.dead > 0;
    const isDirty = counts.pending + counts.failed + counts.dead > 0;
    const hadFailure = prev.failed + prev.dead > 0;
    const hasFailure = counts.failed + counts.dead > 0;
    // A sync failed (or dead-lettered) for this visit. Dead-lettered entries
    // need a manual re-save/retry; transient failures auto-heal on backoff.
    if (!hadFailure && hasFailure) {
      toast.error(counts.dead > 0 ? UNSYNCED_COPY : RETRYING_COPY);
      return;
    }
    // Everything unsynced cleared while online.
    if (wasDirty && !isDirty && online) {
      toast.success("Changes synced");
    }
  }, [counts, online]);

  // Refresh on mount and whenever connectivity flips. Uses `.then(setState)`
  // (not `refreshCounts()`) so no setState runs synchronously in an effect
  // (`react-hooks/set-state-in-effect`). The mount read seeds `prevCountsRef`
  // so a `failed`/`dead` entry that predates this page load is not mistaken for
  // a new failure — no toast fires for state the user already saw.
  useEffect(() => {
    void getVisitStats(companyId, visitId).then((next) => {
      prevCountsRef.current = next;
      setCounts(next);
    });
  }, [companyId, visitId]);

  useEffect(() => {
    if (!online) return;
    void getVisitStats(companyId, visitId).then(setCounts);
  }, [online, companyId, visitId]);

  const onSynced = useCallback(() => {
    void refreshCounts();
  }, [refreshCounts]);

  const onFailed = useCallback(() => {
    void refreshCounts();
  }, [refreshCounts]);

  // `onDead` is intentionally not wired: the processor always pairs a
  // dead-letter with `onFailed(entry, true)`, so `onFailed` alone refreshes
  // counts once per dead-letter instead of twice.
  const { drain: drainOnce, inFlight } = useQueueProcessor({
    companyId,
    replay: replayWithVersionCapture,
    classifyError: options.classifyError ?? classifyVisitError,
    onSynced,
    onFailed,
    enabled,
  });

  // Sweep then re-read counts so the badge/toasts reflect the flush's outcome.
  // The pre-sweep refresh matters for the interactive save path: the form
  // enqueues, then calls `drain()` — without observing the entry as `pending`
  // first, the counts never appear dirty and the "Changes synced" transition
  // toast can't fire.
  const drain = useCallback(async () => {
    await refreshCounts();
    const results = await drainOnce();
    await refreshCounts();
    return results;
  }, [drainOnce, refreshCounts]);

  const retry = useCallback(async () => {
    try {
      await retryDead(companyId, visitId);
      await refreshCounts();
      await drain();
    } catch (e) {
      console.error("Retry dead-lettered changes failed:", e);
      toast.error(ERROR_MESSAGES.SAVE_FAILED);
    }
  }, [companyId, visitId, refreshCounts, drain]);

  const status = deriveSyncStatus(counts, { online, inFlight });

  return { status, counts, inFlight, drain, retry };
}
