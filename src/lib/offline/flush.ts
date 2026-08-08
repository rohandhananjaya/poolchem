/**
 * Client-side write-through flush: drains a tenant's pending mutation queue by
 * replaying each entry against an injected Server Action and converging local
 * state with the server.
 *
 * `import "client-only"` — IndexedDB exists only in the browser / Capacitor
 * WebView. The replay function is injected (DIP) so this module never imports a
 * Server Action directly; the visit form supplies
 * `(entry) => saveDraftAction(entry.visitId, entry.payload)`.
 *
 * Success deletes the queue entry and, when the draft still corresponds to the
 * synced entry, the local draft (invariant: a draft exists ⟺ there are unsynced
 * local edits). A draft replaced by a newer save mid-flush is kept so the newer
 * edits survive. Failure leaves the entry `pending` so the queue-processor card
 * can apply retry/backoff and dead-letter state; this module only ever attempts
 * each entry once per call.
 */
import "client-only";

import { deleteDraft } from "./draft-visits";
import { deleteEntry, getPending, getPendingForVisit } from "./mutation-queue";
import type { QueuedMutation } from "./types";

/** Replays a single queued mutation. Resolves on success; rejects on failure. */
export type FlushReplay = (entry: QueuedMutation) => Promise<unknown>;

/** Outcome of one queue entry after a flush attempt. */
export interface FlushResult {
  clientMutationId: string;
  status: "synced" | "failed";
}

/**
 * Drains a tenant's pending mutations in FIFO order. For each entry: attempt
 * `replay(entry)`; on success delete the queue entry and the visit's local
 * draft (only once no unsynced edits remain for the visit); on failure leave
 * the entry pending for a later retry.
 *
 * @param replay - Injected Server Action to replay each entry against.
 * @param opts.limit - Bound the number of entries drained per call.
 */
export async function flushPending(
  companyId: string,
  replay: FlushReplay,
  opts: { limit?: number } = {},
): Promise<FlushResult[]> {
  const pending = await getPending(companyId, opts.limit);
  const results: FlushResult[] = [];

  for (const entry of pending) {
    try {
      await replay(entry);
      await deleteEntry(companyId, entry.clientMutationId);
      // Delete the draft only when no unsynced edits remain for the visit,
      // enforcing the invariant "a draft exists ⟺ there are unsynced local
      // edits". Write-through saves are fire-and-forget, so a second save can
      // replace the draft while this flush's network round-trip is in flight;
      // that newer save leaves its own pending entry, which keeps the draft.
      const remaining = await getPendingForVisit(companyId, entry.visitId);
      if (remaining.length === 0) {
        await deleteDraft(companyId, entry.visitId);
      }
      results.push({ clientMutationId: entry.clientMutationId, status: "synced" });
    } catch {
      // Leave the entry pending — retry/backoff/dead-letter is the queue
      // processor's job. The local draft stays so nothing is lost.
      results.push({ clientMutationId: entry.clientMutationId, status: "failed" });
    }
  }

  return results;
}
