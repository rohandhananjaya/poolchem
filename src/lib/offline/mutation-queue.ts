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
import {
  createClientMutationId,
  type DraftVisitPayload,
  type MutationAction,
  type MutationStatus,
  type QueuedMutation,
} from "./types";

/**
 * Enqueues a mutation for later replay. Uses the payload's own
 * `clientMutationId` when present (the visit form mints one for offline replay)
 * so re-enqueues of the same logical write stay idempotent; otherwise mints a
 * fresh key. A duplicate `[companyId+clientMutationId]` entry is ignored.
 *
 * @returns The stored entry, or the pre-existing entry when already queued.
 */
export async function enqueue(
  companyId: string,
  action: MutationAction,
  visitId: string,
  payload: DraftVisitPayload,
): Promise<QueuedMutation> {
  const clientMutationId = payload.clientMutationId ?? createClientMutationId();

  // Check + insert in a single readwrite transaction so two concurrent
  // enqueues with the same `[companyId+clientMutationId]` can't both pass the
  // existence check and hit the unique index with a ConstraintError.
  return db.transaction("rw", db.mutationQueue, async () => {
    const existing = await db.mutationQueue
      .where("[companyId+clientMutationId]")
      .equals([companyId, clientMutationId])
      .first();
    if (existing) return existing;

    const now = Date.now();
    const entry: QueuedMutation = {
      companyId,
      action,
      visitId,
      payload,
      clientMutationId,
      status: "pending",
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };
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
    .filter((entry) => entry.visitId === visitId)
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
 * Updates a queued mutation's status. `retryCount`/`lastError` are only written
 * when provided so a status flip alone doesn't wipe prior diagnostics.
 */
export async function markStatus(
  companyId: string,
  clientMutationId: string,
  status: MutationStatus,
  opts: { retryCount?: number; lastError?: string } = {},
): Promise<void> {
  const changes: Partial<QueuedMutation> = {
    status,
    updatedAt: Date.now(),
    ...(opts.retryCount !== undefined ? { retryCount: opts.retryCount } : {}),
    ...(opts.lastError !== undefined ? { lastError: opts.lastError } : {}),
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
    .filter((entry) => entry.visitId === visitId)
    .delete();
}

/**
 * Removes all drafts and queued mutations for a tenant. Called on sign-out or
 * tenant switch so one company's data never leaks to the next session.
 */
export async function clearCompanyData(companyId: string): Promise<void> {
  await db.transaction("rw", db.draftVisits, db.mutationQueue, async () => {
    await db.draftVisits.where("companyId").equals(companyId).delete();
    await db.mutationQueue.where("companyId").equals(companyId).delete();
  });
}
