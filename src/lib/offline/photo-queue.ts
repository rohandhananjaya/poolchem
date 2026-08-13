/**
 * Client-side offline photo queue (IndexedDB via Dexie) — the Blob-capable
 * sibling of `mutation-queue.ts`.
 *
 * Photos captured while offline are queued here with their raw `Blob` and
 * replayed through `uploadVisitPhotoAction` once connectivity returns. Entries
 * are unique per tenant per `clientMutationId` (a re-enqueued upload of the
 * same logical photo is dropped), and the `clientMutationId` doubles as the R2
 * object key seed so a replayed upload overwrites the same object — idempotent
 * end-to-end, no orphaned objects, no duplicate rows.
 *
 * Status/backoff lifecycle mirrors the mutation queue (`MutationStatus`,
 * `backoff.ts`) so the shared sweep engine can drain it unchanged.
 */
import { db } from "./db";
import { createClientMutationId, type QueuedPhoto } from "./types";
import type { QueueStats } from "./mutation-queue";
import type { VisitSyncStats } from "./sync-status";

/**
 * Enqueues a photo upload for later replay. Mints a `clientMutationId` when
 * none is supplied (a caller minting one up front — e.g. to seed the pending
 * tile before the async write — passes it so re-enqueues stay idempotent). A
 * duplicate `[companyId+clientMutationId]` entry is ignored.
 *
 * @returns The stored entry, or the pre-existing entry when already queued.
 */
export async function enqueuePhoto(
  companyId: string,
  visitId: string,
  serviceVisitPoolId: string,
  file: File,
  clientMutationId: string = createClientMutationId(),
): Promise<QueuedPhoto> {
  return db.transaction("rw", db.photoQueue, async () => {
    const existing = await db.photoQueue
      .where("[companyId+clientMutationId]")
      .equals([companyId, clientMutationId])
      .first();
    if (existing) return existing;

    const now = Date.now();
    const entry: QueuedPhoto = {
      companyId,
      clientMutationId,
      visitId,
      serviceVisitPoolId,
      kind: "upload",
      blob: file,
      mimeType: file.type,
      status: "pending",
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    const id = await db.photoQueue.add(entry);
    return { ...entry, id };
  });
}

/** Options for a `getDuePhotos` sweep. */
export interface PhotoDueOptions {
  /** Reference "now" for the `nextRetryAt` check. Defaults to `Date.now()`. */
  now?: number;
  /** Bound the number of entries returned per sweep. */
  limit?: number;
}

/**
 * Returns the entries a photo sweep should attempt, FIFO by `createdAt`: every
 * `pending` entry plus every `failed` entry whose `nextRetryAt` is due (or was
 * never set). Entries still inside their backoff window are excluded. Mirrors
 * `getDue` in `mutation-queue.ts`.
 */
export async function getDuePhotos(
  companyId: string,
  opts: PhotoDueOptions = {},
): Promise<QueuedPhoto[]> {
  const { now = Date.now(), limit } = opts;
  const [pending, failed] = await Promise.all([
    db.photoQueue
      .where("[companyId+status]")
      .equals([companyId, "pending"])
      .toArray(),
    db.photoQueue
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

/**
 * Updates a queued photo's status. `retryCount`/`lastError`/`nextRetryAt` are
 * only written when provided so a status flip alone doesn't wipe prior
 * diagnostics. Mirrors `markStatus` in `mutation-queue.ts`.
 */
export async function markPhotoStatus(
  companyId: string,
  clientMutationId: string,
  status: QueuedPhoto["status"],
  opts: {
    retryCount?: number;
    lastError?: string;
    nextRetryAt?: number;
  } = {},
): Promise<void> {
  const changes: Partial<QueuedPhoto> = {
    status,
    updatedAt: Date.now(),
    ...(opts.retryCount !== undefined ? { retryCount: opts.retryCount } : {}),
    ...(opts.lastError !== undefined ? { lastError: opts.lastError } : {}),
    ...(opts.nextRetryAt !== undefined ? { nextRetryAt: opts.nextRetryAt } : {}),
  };
  await db.photoQueue
    .where("[companyId+clientMutationId]")
    .equals([companyId, clientMutationId])
    .modify(changes);
}

/**
 * Removes a single queued photo for a tenant. Used after a successful replay
 * and when the tech deletes a still-pending tile.
 */
export async function deletePhotoEntry(
  companyId: string,
  clientMutationId: string,
): Promise<void> {
  await db.photoQueue
    .where("[companyId+clientMutationId]")
    .equals([companyId, clientMutationId])
    .delete();
}

/** Returns a tenant's queued-photo counts by status (mirrors `getStats`). */
export async function getPhotoStats(companyId: string): Promise<QueueStats> {
  const [pending, processing, failed, dead] = await Promise.all([
    db.photoQueue
      .where("[companyId+status]")
      .equals([companyId, "pending"])
      .count(),
    db.photoQueue
      .where("[companyId+status]")
      .equals([companyId, "processing"])
      .count(),
    db.photoQueue
      .where("[companyId+status]")
      .equals([companyId, "failed"])
      .count(),
    db.photoQueue
      .where("[companyId+status]")
      .equals([companyId, "dead"])
      .count(),
  ]);
  return { pending, processing, failed, dead };
}

/**
 * Returns one visit's queued-photo counts (`pending`, `failed`, `dead`) within
 * a tenant. Resolved via the `[companyId+visitId]` index.
 */
export async function getPhotoVisitStats(
  companyId: string,
  visitId: string,
): Promise<VisitSyncStats> {
  const rows = await db.photoQueue
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
 * Returns a body of water's queued photo uploads (all statuses) — the
 * reconciliation read for `VisitPhotoCapture`: pending local tiles are shown
 * alongside the server photos and dropped once a server row with the same
 * `clientMutationId` arrives.
 */
export async function getPendingPhotosForBody(
  companyId: string,
  serviceVisitPoolId: string,
): Promise<QueuedPhoto[]> {
  return db.photoQueue
    .where("[companyId+serviceVisitPoolId]")
    .equals([companyId, serviceVisitPoolId])
    .sortBy("createdAt");
}

/** Counts a body's queued photo uploads (reconciliation badge / chip). */
export async function countPendingPhotosForBody(
  companyId: string,
  serviceVisitPoolId: string,
): Promise<number> {
  return db.photoQueue
    .where("[companyId+serviceVisitPoolId]")
    .equals([companyId, serviceVisitPoolId])
    .count();
}
