/**
 * Client-side queue processor: drains a tenant's due queue (mutation or photo)
 * with retry/backoff and dead-letter state.
 *
 * `import "client-only"` — IndexedDB exists only in the browser / Capacitor
 * WebView. The replay function is injected (DIP) so this module never imports a
 * Server Action directly; the visit form supplies
 * `(entry) => saveDraftAction(entry.visitId, entry.payload)` and the photo
 * queue supplies a replay through `uploadVisitPhotoAction`.
 *
 * Sweep semantics (per entry):
 * - replay `entry`. In-flight entries are tracked in a module-local set that is
 *   never persisted — the single-flight guard prevents same-tab overlap, and a
 *   killed app/tab drops the set while the entry is still `pending` in
 *   IndexedDB, so a reload re-selects it (crash recovery).
 * - success → delete the queue entry, then the queue's post-sync hook (the
 *   mutation queue retires the visit's draft once no entries remain; the photo
 *   queue has no draft concept).
 * - transient failure + retry budget left → `failed`, `retryCount+1`, and a
 *   `nextRetryAt` computed from `backoff.ts` so the entry is not retried before
 *   its schedule allows (persisted, so a reload resumes the schedule).
 * - transient failure with budget exhausted, or a permanent failure (per
 *   `classifyError`) → `dead` + `onDead(entry)` so the UI can surface it.
 *
 * Guards prevent wasted, overlapping, or wedged work:
 * - offline gate: a sweep is a no-op while `navigator.onLine === false`, so an
 *   offline spell never consumes retry budget or dead-letters entries.
 * - single-flight: only one sweep (mutation OR photo — the guard is shared) runs
 *   at a time; concurrent calls skip.
 * - replay timeout: a `replay` that never settles is bounded by
 *   `replayTimeoutMs` (treated as a transient failure) so it can't keep the
 *   single-flight guard set forever.
 *
 * The sweep engine is extracted into `runSweep` (OCP): `drainOnce` and
 * `drainPhotosOnce` are thin wrappers over it. `drainOnce`'s public signature is
 * unchanged, so its existing tests are the refactor guard.
 */
import "client-only";

import { deleteDraft } from "./draft-visits";
import {
  countEntriesForVisit,
  deleteEntry,
  getDue,
  markStatus,
} from "./mutation-queue";
import { deletePhotoEntry, getDuePhotos, markPhotoStatus } from "./photo-queue";
import { computeNextRetryAt, MAX_RETRIES } from "./backoff";
import type { MutationStatus, QueuedMutation, QueuedPhoto } from "./types";

/** Replays a single queued mutation. Resolves on success; rejects on failure. */
export type FlushReplay = (entry: QueuedMutation) => Promise<unknown>;

/** Replays a single queued photo upload. Resolves on success; rejects on failure. */
export type PhotoReplay = (entry: QueuedPhoto) => Promise<unknown>;

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

export interface PhotoDrainOptions {
  /** Reference "now" for the `nextRetryAt` check. Defaults to `Date.now()`. */
  now?: number;
  /** Bound the number of entries attempted per sweep. */
  limit?: number;
  /**
   * Returns `true` when `err` is permanent (dead-letter immediately instead of
   * burning retries). Default: all failures are transient.
   */
  classifyError?: (err: unknown, entry: QueuedPhoto) => boolean;
  /** Mirrors `DrainOptions.scheduleRetry`. Default `true`. */
  scheduleRetry?: boolean;
  /** Mirrors `DrainOptions.replayTimeoutMs`. Default 30000. */
  replayTimeoutMs?: number;
  /** Fired when an entry transitions to `dead`. */
  onDead?: (entry: QueuedPhoto) => void;
  /** Fired when an entry syncs successfully (after the entry is deleted). */
  onSynced?: (entry: QueuedPhoto) => void;
  /** Fired when an entry fails; `permanent` mirrors `DrainOptions.onFailed`. */
  onFailed?: (entry: QueuedPhoto, permanent: boolean) => void;
}

// Single-flight guard: only one sweep (across BOTH queues) per tab at a time.
// Reset by tests.
let sweepInFlight = false;

/**
 * Entries currently being replayed, tracked in memory only — never persisted.
 * A killed app/tab drops this set while the entry stays `pending` in
 * IndexedDB, so a reload re-attempts it (crash recovery); the single-flight
 * guard already prevents same-tab overlap. Shared across queues by
 * `clientMutationId`.
 */
const inFlight = new Set<string>();

/** Test hook — clears the single-flight guard between test cases. */
export function _resetSweepGuardForTests(): void {
  sweepInFlight = false;
  inFlight.clear();
}

/** Every sweepable queue entry carries an idempotency key. */
interface SweepEntry {
  clientMutationId: string;
  retryCount: number;
}

/** The persistence surface a sweep engine needs from its queue backend. */
interface SweepQueue<E extends SweepEntry> {
  getDue: (
    companyId: string,
    opts: { now?: number; limit?: number },
  ) => Promise<E[]>;
  deleteEntry: (companyId: string, clientMutationId: string) => Promise<void>;
  markStatus: (
    companyId: string,
    clientMutationId: string,
    status: MutationStatus,
    opts: { retryCount?: number; lastError?: string; nextRetryAt?: number },
  ) => Promise<void>;
  /** Post-sync hook, when the backend has one (mutation: retire the draft). */
  onEntrySynced?: (companyId: string, entry: E) => Promise<void>;
}

interface SweepOptions<E extends SweepEntry> {
  now?: number;
  limit?: number;
  classifyError?: (err: unknown, entry: E) => boolean;
  scheduleRetry?: boolean;
  replayTimeoutMs?: number;
  onDead?: (entry: E) => void;
  onSynced?: (entry: E) => void;
  onFailed?: (entry: E, permanent: boolean) => void;
}

/**
 * Bounds a single `replay` call so a fetch that never settles can't keep the
 * single-flight guard set forever. A timeout surfaces as a transient failure
 * and is scheduled for retry like any other.
 */
async function replayWithTimeout<E extends SweepEntry>(
  replay: (entry: E) => Promise<unknown>,
  entry: E,
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
 * Success cleanup for the mutation queue: remove the synced entry, then delete
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

/** Mutation-queue backend for the sweep engine. */
const mutationSweepQueue: SweepQueue<QueuedMutation> = {
  getDue,
  deleteEntry,
  markStatus,
  onEntrySynced: deleteEntryAndDraftIfIdle,
};

/** Photo-queue backend — no draft concept, so no `onEntrySynced`. */
const photoSweepQueue: SweepQueue<QueuedPhoto> = {
  getDue: getDuePhotos,
  deleteEntry: deletePhotoEntry,
  markStatus: markPhotoStatus,
};

/**
 * The generic sweep engine shared by the mutation and photo queues (OCP: a new
 * queue is a new backend, not a new processor). Attempts a retry-aware sweep of
 * a tenant's due entries; returns the outcome for each attempted.
 */
async function runSweep<E extends SweepEntry>(
  companyId: string,
  replay: (entry: E) => Promise<unknown>,
  queue: SweepQueue<E>,
  opts: SweepOptions<E> = {},
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
    const due = (await queue.getDue(companyId, { now, limit })).filter(
      (entry) => !inFlight.has(entry.clientMutationId),
    );
    const results: DrainResult[] = [];

    for (const entry of due) {
      inFlight.add(entry.clientMutationId);
      try {
        try {
          await replayWithTimeout(replay, entry, replayTimeoutMs);
          await queue.deleteEntry(companyId, entry.clientMutationId);
          await queue.onEntrySynced?.(companyId, entry);
          onSynced?.(entry);
          results.push({ clientMutationId: entry.clientMutationId, status: "synced" });
        } catch (err) {
          const permanent = classifyError?.(err, entry) ?? false;
          const lastError = err instanceof Error ? err.message : String(err);
          if (permanent || (scheduleRetry && entry.retryCount >= MAX_RETRIES)) {
            // Dead-letter: never retried automatically; surfaced via onDead.
            await queue.markStatus(companyId, entry.clientMutationId, "dead", {
              lastError,
            });
            onDead?.(entry);
            onFailed?.(entry, true);
            results.push({ clientMutationId: entry.clientMutationId, status: "dead" });
          } else if (scheduleRetry) {
            // Transient: schedule the next attempt with exponential backoff.
            await queue.markStatus(companyId, entry.clientMutationId, "failed", {
              retryCount: entry.retryCount + 1,
              lastError,
              nextRetryAt: computeNextRetryAt(now, entry.retryCount),
            });
            onFailed?.(entry, false);
            results.push({ clientMutationId: entry.clientMutationId, status: "failed" });
          } else {
            // One-shot drain: revert to pending for a later scheduled sweep.
            await queue.markStatus(companyId, entry.clientMutationId, "pending", {
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

/**
 * Attempts a retry-aware sweep of a tenant's due mutations. Returns the outcome
 * for each entry attempted; skipped sweeps (offline, or one already in flight)
 * return `[]`. Public signature unchanged by the generic-extraction refactor.
 */
export async function drainOnce(
  companyId: string,
  replay: FlushReplay,
  opts: DrainOptions = {},
): Promise<DrainResult[]> {
  return runSweep(companyId, replay, mutationSweepQueue, opts);
}

/**
 * Attempts a retry-aware sweep of a tenant's due photo uploads — the same engine
 * as `drainOnce`, so a mutation sweep and a photo sweep serialize (shared
 * single-flight guard; interval re-fires, so no starvation). A successful photo
 * sync deletes the queue entry only — there is no draft to retire.
 */
export async function drainPhotosOnce(
  companyId: string,
  replay: PhotoReplay,
  opts: PhotoDrainOptions = {},
): Promise<DrainResult[]> {
  return runSweep(companyId, replay, photoSweepQueue, opts);
}