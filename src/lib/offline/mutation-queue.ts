/**
 * Client-side offline mutation queue (IndexedDB via Dexie).
 *
 * Every write the tech makes while offline is queued here and replayed to the
 * matching Server Action once connectivity returns. Entries are unique per
 * tenant per `clientMutationId` so a re-enqueued mutation can never duplicate a
 * server write (the Server Action is idempotent on that key). Draining is FIFO
 * by `createdAt`, scoped to a tenant via the `[companyId+status]` index.
 *
 * The queue is drained by the queue-processor work (later card); this module
 * only persists and queries entries.
 */
import { db } from "./db";
import type { VisitSyncStats } from "./sync-status";
import {
  createClientMutationId,
  type ActionPayloadMap,
  type MutationAction,
  type MutationStatus,
  type QueuedMutation,
  type QueuedMutationByAction,
  type VisitScopedAction,
} from "./types";

/**
 * Enqueues a mutation for later replay. Uses the payload's own
 * `clientMutationId` when present (the visit form mints one for offline replay)
 * so re-enqueues of the same logical write stay idempotent; otherwise mints a
 * fresh key. A duplicate `[companyId+clientMutationId]` entry is ignored.
 *
 * Generic on the action so the call site is type-checked end to end: visit-scoped
 * actions require a `visitId` and a `DraftVisitPayload`-shaped payload; pool /
 * `createVisit` actions take `undefined` for `visitId` and their own payload.
 *
 * @returns The stored entry (typed to the action), or the pre-existing entry
 *          when already queued.
 */
export async function enqueue<A extends MutationAction>(
  companyId: string,
  action: A,
  visitId: A extends VisitScopedAction ? string : undefined,
  payload: ActionPayloadMap[A],
): Promise<QueuedMutationByAction[A]> {
  const clientMutationId =
    (payload as { clientMutationId?: string }).clientMutationId ??
    createClientMutationId();

  // Check + insert in a single readwrite transaction so two concurrent
  // enqueues with the same `[companyId+clientMutationId]` can't both pass the
  // existence check and hit the unique index with a ConstraintError.
  return db.transaction("rw", db.mutationQueue, async () => {
    const existing = await db.mutationQueue
      .where("[companyId+clientMutationId]")
      .equals([companyId, clientMutationId])
      .first();
    if (existing) return existing as QueuedMutationByAction[A];

    const now = Date.now();
    // The `action` discriminant is generic here, so TS can't derive the narrowed
    // variant from the object literal; the action/payload pairing is enforced by
    // the signature above and `enqueue` is the single persistence boundary, so a
    // boundary cast is the right trade-off.
    const entry = {
      companyId,
      action,
      ...(visitId !== undefined ? { visitId } : {}),
      payload,
      clientMutationId,
      status: "pending",
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    } as QueuedMutationByAction[A];
    const id = await db.mutationQueue.add(entry);
    return { ...entry, id };
  });
}

/**
 * Returns a tenant's pending mutations in FIFO order (oldest first), for the
 * queue processor to drain. Optional `limit` bounds the batch.
 */
export async function getPending(
  companyId: string,
  limit?: number,
): Promise<QueuedMutation[]> {
  const pending = await db.mutationQueue
    .where("[companyId+status]")
    .equals([companyId, "pending"])
    .sortBy("createdAt");
  return limit !== undefined ? pending.slice(0, limit) : pending;
}

/** Returns a tenant's pending mutations for a single visit, FIFO ordered. */
export async function getPendingForVisit(
  companyId: string,
  visitId: string,
): Promise<QueuedMutation[]> {
  return db.mutationQueue
    .where("[companyId+status]")
    .equals([companyId, "pending"])
    .filter((entry) => "visitId" in entry && entry.visitId === visitId)
    .sortBy("createdAt");
}

/** Returns a queued mutation by its clientMutationId, or `null`. */
export async function getByClientMutationId(
  companyId: string,
  clientMutationId: string,
): Promise<QueuedMutation | null> {
  return (
    (await db.mutationQueue
      .where("[companyId+clientMutationId]")
      .equals([companyId, clientMutationId])
      .first()) ?? null
  );
}

/**
 * Updates a queued mutation's status. `retryCount`/`lastError`/`nextRetryAt`
 * are only written when provided so a status flip alone doesn't wipe prior
 * diagnostics.
 */
export async function markStatus(
  companyId: string,
  clientMutationId: string,
  status: MutationStatus,
  opts: {
    retryCount?: number;
    lastError?: string;
    nextRetryAt?: number;
  } = {},
): Promise<void> {
  const changes: Partial<QueuedMutation> = {
    status,
    updatedAt: Date.now(),
    ...(opts.retryCount !== undefined ? { retryCount: opts.retryCount } : {}),
    ...(opts.lastError !== undefined ? { lastError: opts.lastError } : {}),
    ...(opts.nextRetryAt !== undefined ? { nextRetryAt: opts.nextRetryAt } : {}),
  };
  await db.mutationQueue
    .where("[companyId+clientMutationId]")
    .equals([companyId, clientMutationId])
    .modify(changes);
}

/**
 * Removes a single queued mutation for a tenant. Used by the write-through
 * flush path once a mutation has been replayed to the server successfully.
 */
export async function deleteEntry(
  companyId: string,
  clientMutationId: string,
): Promise<void> {
  await db.mutationQueue
    .where("[companyId+clientMutationId]")
    .equals([companyId, clientMutationId])
    .delete();
}

/**
 * Removes every queued mutation for a visit within a tenant. Used when a visit
 * is completed or cancelled locally so stale `saveDraft` entries aren't
 * replayed against a server visit that no longer accepts them.
 */
export async function deleteEntriesForVisit(
  companyId: string,
  visitId: string,
): Promise<void> {
  await db.mutationQueue
    .where("companyId")
    .equals(companyId)
    .filter((entry) => "visitId" in entry && entry.visitId === visitId)
    .delete();
}

/** Options for a `getDue` sweep. */
export interface DueOptions {
  /** Reference "now" for the `nextRetryAt` check. Defaults to `Date.now()`. */
  now?: number;
  /** Bound the number of entries returned per sweep. */
  limit?: number;
}

/**
 * Returns the entries a queue sweep should attempt, FIFO by `createdAt`:
 * every `pending` entry plus every `failed` entry whose `nextRetryAt` is due
 * (or was never set — legacy entries from before backoff scheduling). Entries
 * still inside their backoff window are excluded.
 */
export async function getDue(
  companyId: string,
  opts: DueOptions = {},
): Promise<QueuedMutation[]> {
  const { now = Date.now(), limit } = opts;
  // Query via the `[companyId+status]` index rather than materializing the
  // whole tenant queue: only `pending` and (possibly due) `failed` entries can
  // be replayed.
  const [pending, failed] = await Promise.all([
    db.mutationQueue
      .where("[companyId+status]")
      .equals([companyId, "pending"])
      .toArray(),
    db.mutationQueue
      .where("[companyId+status]")
      .equals([companyId, "failed"])
      .toArray(),
  ]);
  const due = [...pending, ...failed]
    .filter(
      (entry) =>
        entry.nextRetryAt === undefined || entry.nextRetryAt <= now,
    )
    .sort((a, b) => a.createdAt - b.createdAt);
  return limit !== undefined ? due.slice(0, limit) : due;
}

/** Returns a tenant's dead-lettered mutations (never replayed automatically). */
export async function getDead(companyId: string): Promise<QueuedMutation[]> {
  return db.mutationQueue
    .where("[companyId+status]")
    .equals([companyId, "dead"])
    .sortBy("createdAt");
}

/** Returns a tenant's dead-lettered mutations for one visit, FIFO ordered. */
export async function getDeadForVisit(
  companyId: string,
  visitId: string,
): Promise<QueuedMutation[]> {
  return db.mutationQueue
    .where("[companyId+status]")
    .equals([companyId, "dead"])
    .filter((entry) => "visitId" in entry && entry.visitId === visitId)
    .sortBy("createdAt");
}

/**
 * Counts every queued mutation for a visit regardless of status. Used by the
 * success-cleanup invariant (a draft is dropped only once zero entries remain
 * for the visit) — a `failed` or `dead` entry still holds unsynced local edits.
 */
export async function countEntriesForVisit(
  companyId: string,
  visitId: string,
): Promise<number> {
  return db.mutationQueue
    .where("companyId")
    .equals(companyId)
    .filter((entry) => "visitId" in entry && entry.visitId === visitId)
    .count();
}

/**
 * Deletes a visit's dead-lettered entries. Called after a re-save so a stale
 * dead entry — whose payload the newer draft supersedes — is dropped instead of
 * lingering in diagnostics.
 */
export async function deleteDeadForVisit(
  companyId: string,
  visitId: string,
): Promise<void> {
  await db.mutationQueue
    .where("companyId")
    .equals(companyId)
    .filter(
      (entry) =>
        "visitId" in entry && entry.visitId === visitId && entry.status === "dead",
    )
    .delete();
}

/**
 * Retries a visit's dead-lettered entries: resets each to `pending` with a
 * cleared retry budget and schedule so the queue processor re-attempts them on
 * its next sweep.
 */
export async function retryDead(
  companyId: string,
  visitId: string,
): Promise<void> {
  await db.mutationQueue
    .where("companyId")
    .equals(companyId)
    .filter(
      (entry) =>
        "visitId" in entry && entry.visitId === visitId && entry.status === "dead",
    )
    .modify((entry) => {
      entry.status = "pending";
      entry.retryCount = 0;
      delete entry.nextRetryAt;
      delete entry.lastError;
      entry.updatedAt = Date.now();
    });
}

/** Per-status queue counts for a tenant — feeds the sync-status UI. */
export interface QueueStats {
  pending: number;
  processing: number;
  failed: number;
  dead: number;
}

/** Returns a tenant's queue counts by status. */
export async function getStats(companyId: string): Promise<QueueStats> {
  const [pending, processing, failed, dead] = await Promise.all([
    db.mutationQueue
      .where("[companyId+status]")
      .equals([companyId, "pending"])
      .count(),
    db.mutationQueue
      .where("[companyId+status]")
      .equals([companyId, "processing"])
      .count(),
    db.mutationQueue
      .where("[companyId+status]")
      .equals([companyId, "failed"])
      .count(),
    db.mutationQueue
      .where("[companyId+status]")
      .equals([companyId, "dead"])
      .count(),
  ]);
  return { pending, processing, failed, dead };
}

/**
 * Returns one visit's queue counts (`pending`, `failed`, `dead`) within a
 * tenant — the per-visit stats the sync-status UI badges on. Resolved via the
 * `[companyId+visitId]` index, so it never scans the whole tenant queue;
 * `processing` is never persisted (the processor tracks it only in memory), so
 * it is not tallied. `getStats` stays for any future tenant-level surface.
 */
export async function getVisitStats(
  companyId: string,
  visitId: string,
): Promise<VisitSyncStats> {
  const rows = await db.mutationQueue
    .where("[companyId+visitId]")
    .equals([companyId, visitId])
    .toArray();
  const stats: VisitSyncStats = { pending: 0, failed: 0, dead: 0 };
  for (const entry of rows) {
    if (entry.status === "pending") stats.pending += 1;
    else if (entry.status === "failed") stats.failed += 1;
    else if (entry.status === "dead") stats.dead += 1;
  }
  return stats;
}

/**
 * Removes all drafts, queued mutations, and the pools + visits read caches for a
 * tenant. Called on sign-out or tenant switch so one company's data never leaks
 * to the next session.
 */
export async function clearCompanyData(companyId: string): Promise<void> {
  await db.transaction(
    "rw",
    db.draftVisits,
    db.mutationQueue,
    db.poolCache,
    db.visitCache,
    async () => {
      await db.draftVisits.where("companyId").equals(companyId).delete();
      await db.mutationQueue.where("companyId").equals(companyId).delete();
      await db.poolCache.delete(companyId);
      await db.visitCache.where("companyId").equals(companyId).delete();
    },
  );
}
