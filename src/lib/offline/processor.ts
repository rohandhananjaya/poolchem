/**
 * Client-side queue processor: drains a tenant's due mutation queue with
 * retry/backoff and dead-letter state.
 *
 * `import "client-only"` — IndexedDB exists only in the browser / Capacitor
 * WebView. The replay function is injected (DIP) so this module never imports a
 * Server Action directly; the visit form supplies
 * `(entry) => saveDraftAction(entry.visitId, entry.payload)`.
 *
 * Sweep semantics (per entry):
 * - replay `entry`. In-flight entries are tracked in a module-local set that is
 *   never persisted — the single-flight guard prevents same-tab overlap, and a
 *   killed app/tab drops the set while the entry is still `pending` in
 *   IndexedDB, so a reload re-selects it (crash recovery).
 * - success → delete the queue entry and, when no unsynced edits remain for the
 *   visit, the local draft (invariant: a draft exists ⟺ there are unsynced
 *   edits).
 * - transient failure + retry budget left → `failed`, `retryCount+1`, and a
 *   `nextRetryAt` computed from `backoff.ts` so the entry is not retried before
 *   its schedule allows (persisted, so a reload resumes the schedule).
 * - transient failure with budget exhausted, or a permanent failure (per
 *   `classifyError`) → `dead` + `onDead(entry)` so the UI can surface it.
 *
 * Guards prevent wasted, overlapping, or wedged work:
 * - offline gate: a sweep is a no-op while `navigator.onLine === false`, so an
 *   offline spell never consumes retry budget or dead-letters entries.
 * - single-flight: only one sweep runs at a time; concurrent calls skip.
 * - replay timeout: a `replay` that never settles is bounded by
 *   `replayTimeoutMs` (treated as a transient failure) so it can't keep the
 *   single-flight guard set forever.
 */
import "client-only";

import { deleteDraft } from "./draft-visits";
import {
  countEntriesForVisit,
  deleteEntry,
  getDue,
  markStatus,
} from "./mutation-queue";
import { computeNextRetryAt, MAX_RETRIES } from "./backoff";
import type { QueuedMutation } from "./types";

/** Replays a single queued mutation. Resolves on success; rejects on failure. */
export type FlushReplay = (entry: QueuedMutation) => Promise<unknown>;

/** Outcome of one queue entry after a sweep attempt. */
export interface DrainResult {
  clientMutationId: string;
  status: "synced" | "failed" | "dead";
}

export interface DrainOptions {
  /** Reference "now" for the `nextRetryAt` check. Defaults to `Date.now()`. */
  now?: number;
  /** Bound the number of entries attempted per sweep. */
  limit?: number;
  /**
   * Returns `true` when `err` is permanent (dead-letter immediately instead of
   * burning retries). Default: all failures are transient.
   */
  classifyError?: (err: unknown, entry: QueuedMutation) => boolean;
  /**
   * Apply retry/backoff transitions on transient failure. Disabled for a
   * one-shot drain, which instead reverts a failed entry to `pending` for a
   * later scheduled sweep. Default `true`.
   */
  scheduleRetry?: boolean;
  /**
   * Bound each `replay` call (ms) so a fetch that never settles can't wedge the
   * single-flight guard. A timeout is treated as a transient failure (scheduled
   * retry). Default 30000; pass 0 to disable.
   */
  replayTimeoutMs?: number;
  /** Fired when an entry transitions to `dead`. */
  onDead?: (entry: QueuedMutation) => void;
  /** Fired when an entry syncs successfully (after the entry is deleted). */
  onSynced?: (entry: QueuedMutation) => void;
  /**
   * Fired when an entry fails. `permanent` is `true` when the entry
   * dead-lettered (never retried automatically), `false` when it was scheduled
   * for a later retry (or reverted to `pending` in a one-shot drain).
   */
  onFailed?: (entry: QueuedMutation, permanent: boolean) => void;
}

// Single-flight guard: only one sweep per tab at a time. Reset by tests.
let sweepInFlight = false;

/**
 * Entries currently being replayed, tracked in memory only — never persisted.
 * A killed app/tab drops this set while the entry stays `pending` in
 * IndexedDB, so a reload re-attempts it (crash recovery); the single-flight
 * guard already prevents same-tab overlap.
 */
const inFlight = new Set<string>();

/** Test hook — clears the single-flight guard between test cases. */
export function _resetSweepGuardForTests(): void {
  sweepInFlight = false;
  inFlight.clear();
}

/**
 * Bounds a single `replay` call so a fetch that never settles can't keep the
 * single-flight guard set forever. A timeout surfaces as a transient failure
 * and is scheduled for retry like any other.
 */
async function replayWithTimeout(
  replay: FlushReplay,
  entry: QueuedMutation,
  timeoutMs: number,
): Promise<unknown> {
  if (!timeoutMs || timeoutMs <= 0) return replay(entry);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      replay(entry),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Replay timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Success cleanup shared by every sweep: remove the synced entry, then delete
 * the visit's draft only when no entries remain for it. Counting all statuses
 * (not just `pending`) keeps the draft while a `failed`/`dead` entry still
 * holds unsynced local edits.
 */
async function deleteEntryAndDraftIfIdle(
  companyId: string,
  entry: QueuedMutation,
): Promise<void> {
  await deleteEntry(companyId, entry.clientMutationId);
  // Drafts exist only for visit-scoped actions; `createVisit`/pool entries carry
  // no visitId, so there is no draft to retire after they sync.
  if ("visitId" in entry) {
    const remaining = await countEntriesForVisit(companyId, entry.visitId);
    if (remaining === 0) {
      await deleteDraft(companyId, entry.visitId);
    }
  }
}

/**
 * Attempts a retry-aware sweep of a tenant's due mutations. Returns the outcome
 * for each entry attempted; skipped sweeps (offline, or one already in flight)
 * return `[]`.
 */
export async function drainOnce(
  companyId: string,
  replay: FlushReplay,
  opts: DrainOptions = {},
): Promise<DrainResult[]> {
  // Offline gate first — an offline spell must never consume retry budget or
  // dead-letter entries. The hook additionally gates on `useOnlineStatus` so
  // the optimistic first-paint snapshot can't trigger a sweep.
  if (typeof navigator !== "undefined" && navigator.onLine === false) return [];
  if (sweepInFlight) return [];
  sweepInFlight = true;

  try {
    const {
      now = Date.now(),
      limit,
      classifyError,
      scheduleRetry = true,
      replayTimeoutMs = 30000,
      onDead,
      onSynced,
      onFailed,
    } = opts;
    // Entries already being replayed in this tab are skipped; the DB status is
    // never flipped to `processing`, so a reload can always re-select them.
    const due = (await getDue(companyId, { now, limit })).filter(
      (entry) => !inFlight.has(entry.clientMutationId),
    );
    const results: DrainResult[] = [];

    for (const entry of due) {
      inFlight.add(entry.clientMutationId);
      try {
        try {
          await replayWithTimeout(replay, entry, replayTimeoutMs);
          await deleteEntryAndDraftIfIdle(companyId, entry);
          onSynced?.(entry);
          results.push({ clientMutationId: entry.clientMutationId, status: "synced" });
        } catch (err) {
          const permanent = classifyError?.(err, entry) ?? false;
          const lastError = err instanceof Error ? err.message : String(err);
          if (permanent || (scheduleRetry && entry.retryCount >= MAX_RETRIES)) {
            // Dead-letter: never retried automatically; surfaced via onDead.
            await markStatus(companyId, entry.clientMutationId, "dead", {
              lastError,
            });
            onDead?.(entry);
            onFailed?.(entry, true);
            results.push({ clientMutationId: entry.clientMutationId, status: "dead" });
          } else if (scheduleRetry) {
            // Transient: schedule the next attempt with exponential backoff.
            await markStatus(companyId, entry.clientMutationId, "failed", {
              retryCount: entry.retryCount + 1,
              lastError,
              nextRetryAt: computeNextRetryAt(now, entry.retryCount),
            });
            onFailed?.(entry, false);
            results.push({ clientMutationId: entry.clientMutationId, status: "failed" });
          } else {
            // One-shot drain: revert to pending for a later scheduled sweep.
            await markStatus(companyId, entry.clientMutationId, "pending", {
              lastError,
            });
            onFailed?.(entry, false);
            results.push({ clientMutationId: entry.clientMutationId, status: "failed" });
          }
        }
      } finally {
        inFlight.delete(entry.clientMutationId);
      }
    }

    return results;
  } finally {
    sweepInFlight = false;
  }
}
