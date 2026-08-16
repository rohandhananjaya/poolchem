"use client";

import { drainPhotosOnce } from "@/lib/offline/processor";
import type { QueuedPhoto } from "@/lib/offline/types";
import { extensionForPhotoMimeType } from "@/lib/storage/photo-format";
import {
  classifyVisitError,
} from "./use-visit-sync-status";
import {
  useQueueProcessor,
  type UseQueueProcessorOptions,
  type UseQueueProcessorResult,
} from "./use-queue-processor";

/**
 * Default photo replay wiring: replays a queued photo against
 * `uploadVisitPhotoAction`, reconstructing the `File` from the stored `Blob`.
 * `clientMutationId` is forwarded both as the idempotency key AND the R2 object
 * key seed, so a retried upload overwrites the same object and never inserts a
 * duplicate row — the card's orphan/duplicate killer.
 *
 * Lazy import keeps the server-action module out of the hook's module graph —
 * tests inject their own `replay` and never load it.
 */
async function uploadPhotoReplay(entry: QueuedPhoto): Promise<unknown> {
  const { uploadVisitPhotoAction } = await import(
    "@/app/(dashboard)/visits/[visitId]/photo-actions"
  );
  const fd = new FormData();
  fd.set(
    "photo",
    new File(
      [entry.blob],
      `photo-${entry.clientMutationId}.${extensionForPhotoMimeType(entry.mimeType)}`,
      { type: entry.mimeType },
    ),
  );
  const result = await uploadVisitPhotoAction(
    entry.visitId,
    entry.serviceVisitPoolId,
    fd,
    entry.clientMutationId,
  );
  if (!result.ok) throw new Error(result.error ?? "Photo upload failed.");
  return result;
}

/**
 * The photo-queue replay wiring, shared with the `/offline` page's Retry button
 * so both surfaces sync queued photos through the idempotent action.
 */
export const DEFAULT_PHOTO_REPLAY: (entry: QueuedPhoto) => Promise<unknown> =
  uploadPhotoReplay;

export type UsePhotoQueueProcessorOptions = Omit<
  UseQueueProcessorOptions<QueuedPhoto>,
  "drainFn" | "replay"
> & {
  /**
   * Injected Server Action to replay each queued photo against. Defaults to
   * `DEFAULT_PHOTO_REPLAY` (`uploadVisitPhotoAction`, idempotent via
   * `clientMutationId`).
   */
  replay?: (entry: QueuedPhoto) => Promise<unknown>;
};

/**
 * Wires the queue processor's triggers to the PHOTO queue: drains
 * `drainPhotosOnce` on the same triggers as the mutation processor (online +
 * hydrated, visibilitychange, periodic sweep), replaying through
 * `uploadVisitPhotoAction`. Failure classification reuses the visit-form's
 * permanent mapping (deleted visit, other tech's visit → dead-letter
 * immediately); everything else backs off and retries.
 *
 * Photo and mutation sweeps serialize on the shared single-flight guard inside
 * `processor.ts`; the periodic sweep re-fires, so neither queue starves.
 */
export function usePhotoQueueProcessor(
  options: UsePhotoQueueProcessorOptions,
): UseQueueProcessorResult {
  return useQueueProcessor<QueuedPhoto>({
    ...options,
    drainFn: drainPhotosOnce,
    replay: options.replay ?? DEFAULT_PHOTO_REPLAY,
    classifyError: options.classifyError ?? classifyVisitError,
  });
}