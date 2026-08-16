"use client"

import * as React from "react"
import { Camera, Loader2, X } from "lucide-react"
import { toast } from "sonner"

import { validatePhotoFile } from "@/lib/storage/photo-format"
import { Button } from "@/components/ui/button"
import {
  deleteVisitPhotoAction,
  uploadVisitPhotoAction,
} from "@/app/(dashboard)/visits/[visitId]/photo-actions"
import {
  deletePhotoEntry,
  enqueuePhoto,
  getPendingPhotosForBody,
} from "@/lib/offline/photo-queue"
import { useOnlineStatus } from "@/hooks/use-online-status"

/**
 * A server photo tile. `clientMutationId` rides along from the server page
 * (it is stored on `VisitPhoto`) so this component can reconcile pending local
 * tiles against rows that just synced.
 */
export interface VisitPhotoTile {
  id: string
  url: string
  clientMutationId?: string | null
}

export interface VisitPhotoCaptureProps {
  /** Tenant — scopes every offline-queue read/write. */
  companyId: string
  visitId: string
  serviceVisitPoolId: string
  photos: VisitPhotoTile[]
  disabled?: boolean
}

/** A locally-queued (not-yet-synced) tile, shown with a "Queued" chip. */
interface QueuedTile {
  /** The queue entry's idempotency key — also the tile's display key. */
  id: string
  clientMutationId: string
  url: string
}

/**
 * Per-body photo capture with offline-queue fallback. Display is DERIVED:
 * server `photos` ∪ this body's queued uploads (`getPendingPhotosForBody`),
 * deduped by `clientMutationId`. A pick while online uploads through the action
 * (a flaky-network failure degrades to the queue rather than an error toast); a
 * pick while offline enqueues immediately and shows a pending tile. Once the
 * photo processor replays the upload, the action's `revalidatePath` refreshes
 * the page's `photos` prop with the new server row (matching `clientMutationId`)
 * and the pending tile is dropped — reconciliation needs no manual bookkeeping.
 */
export function VisitPhotoCapture({
  companyId,
  visitId,
  serviceVisitPoolId,
  photos,
  disabled = false,
}: VisitPhotoCaptureProps) {
  const { online } = useOnlineStatus()
  // Optimistic mirror of server rows: seeded from the prop, appended on a
  // successful upload, filtered on a successful delete. Deleted ids are ALSO
  // tombstoned so a revalidation that hasn't landed yet can't resurrect a tile
  // from the prop. The merge with the authoritative prop happens at render time.
  const [localPhotos, setLocalPhotos] = React.useState<VisitPhotoTile[]>(photos)
  const [deletedIds, setDeletedIds] = React.useState<string[]>([])
  const [queuedTiles, setQueuedTiles] = React.useState<QueuedTile[]>([])
  const [uploading, startUpload] = React.useTransition()
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  // Tracks object URLs we created so they're revoked when a tile is dropped or
  // the component unmounts (leaked object URLs pin a Blob in memory).
  const objectUrlsRef = React.useRef<Map<string, string>>(new Map())

  // Load this body's queued uploads. Re-runs when `photos` changes so tiles
  // that just synced (their queue entry deleted, or now matched by a server
  // row) drop out of the derived display.
  React.useEffect(() => {
    let cancelled = false
    void getPendingPhotosForBody(companyId, serviceVisitPoolId).then((rows) => {
      if (cancelled) return
      const next: QueuedTile[] = rows.map((entry) => {
        const existing = objectUrlsRef.current.get(entry.clientMutationId)
        const url =
          existing ??
          (() => {
            const created = URL.createObjectURL(entry.blob)
            objectUrlsRef.current.set(entry.clientMutationId, created)
            return created
          })()
        return { id: entry.clientMutationId, clientMutationId: entry.clientMutationId, url }
      })
      const nextIds = new Set(next.map((t) => t.clientMutationId))
      // Revoke URLs for tiles that no longer appear (synced while unmounted,
      // or deleted from the queue) so Blobs aren't pinned.
      for (const [id, url] of objectUrlsRef.current) {
        if (!nextIds.has(id)) {
          URL.revokeObjectURL(url)
          objectUrlsRef.current.delete(id)
        }
      }
      setQueuedTiles(next)
    })
    return () => {
      cancelled = true
    }
  }, [companyId, serviceVisitPoolId, photos])

  // Revoke every object URL this component created on unmount.
  React.useEffect(() => {
    const urls = objectUrlsRef.current
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [])

  async function enqueueAndShow(file: File) {
    const entry = await enqueuePhoto(
      companyId,
      visitId,
      serviceVisitPoolId,
      file,
    )
    const url = URL.createObjectURL(entry.blob)
    objectUrlsRef.current.set(entry.clientMutationId, url)
    setQueuedTiles((prev) =>
      prev.some((t) => t.clientMutationId === entry.clientMutationId)
        ? prev
        : [
            ...prev,
            {
              id: entry.clientMutationId,
              clientMutationId: entry.clientMutationId,
              url,
            },
          ],
    )
  }

  function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    const validation = validatePhotoFile(file)
    if (!validation.ok) {
      toast.error(validation.error)
      return
    }

    // Offline pick → queue immediately (the photo processor syncs it later).
    if (!online) {
      void enqueueAndShow(file)
      toast.info("Photo saved offline — will upload when back online.")
      return
    }

    startUpload(async () => {
      try {
        const fd = new FormData()
        fd.set("photo", file)
        const result = await uploadVisitPhotoAction(
          visitId,
          serviceVisitPoolId,
          fd,
        )
        if (result.ok && result.photo) {
          const photo = result.photo
          setLocalPhotos((prev) => [
            ...prev,
            {
              id: photo.id,
              url: photo.url,
              clientMutationId: photo.clientMutationId,
            },
          ])
          toast.success("Photo added.")
        } else {
          // Server rejected it (e.g. file re-validated) — degrade to the queue.
          await enqueueAndShow(file)
        }
      } catch {
        // Flaky network / server failure → degrade to the queue instead of a
        // dead-end error toast; the photo processor retries with backoff.
        await enqueueAndShow(file)
      }
    })
  }

  function handleDelete(id: string) {
    const queued = queuedTiles.find((t) => t.clientMutationId === id)
    if (queued) {
      void (async () => {
        await deletePhotoEntry(companyId, queued.clientMutationId)
        const url = objectUrlsRef.current.get(queued.clientMutationId)
        if (url) {
          URL.revokeObjectURL(url)
          objectUrlsRef.current.delete(queued.clientMutationId)
        }
        setQueuedTiles((prev) =>
          prev.filter((t) => t.clientMutationId !== queued.clientMutationId),
        )
      })()
      return
    }

    // Server photo — the row + object go through the action; the tile drops
    // optimistically and the page refresh (revalidatePath) confirms it.
    setDeletingId(id)
    startUpload(async () => {
      const result = await deleteVisitPhotoAction(visitId, id)
      if (result.ok) {
        setLocalPhotos((prev) => prev.filter((p) => p.id !== id))
        setDeletedIds((prev) => [...prev, id])
      } else {
        toast.error(result.error ?? "Could not delete photo.")
      }
      setDeletingId(null)
    })
  }

// Derived display: authoritative server rows first, then optimistic local-only
    // rows (an upload whose revalidation hasn't landed), then pending queued
    // tiles whose idempotency key hasn't synced yet. The prop merge is computed
    // at render time (no effect): a revalidated prop drops local-only
    // duplicates and the deleted-ids tombstone keeps a not-yet-pruned prop row
    // hidden.
    const deletedSet = new Set(deletedIds)
    const propTiles = photos.filter((p) => !deletedSet.has(p.id))
    const propIds = new Set(photos.map((p) => p.id))
    const localOnly = localPhotos.filter(
      (p) => !deletedSet.has(p.id) && !propIds.has(p.id),
    )
    const serverIds = new Set(
      photos.filter((p) => p.clientMutationId).map((p) => p.clientMutationId as string),
    )
    const pendingTiles = queuedTiles.filter(
      (t) => !serverIds.has(t.clientMutationId),
    )
    const pendingIds = new Set(pendingTiles.map((t) => t.clientMutationId))
    const tiles = [...propTiles, ...localOnly, ...pendingTiles]

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {!disabled && (
          <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
            <label htmlFor={`visit-photo-${serviceVisitPoolId}`} className="cursor-pointer">
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              Add photo
            </label>
          </Button>
        )}
        <input
          id={`visit-photo-${serviceVisitPoolId}`}
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={handlePick}
          className="sr-only"
        />
      </div>

      {tiles.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {tiles.map((tile) => (
            <div
              key={tile.id}
              className="relative aspect-square overflow-hidden rounded-lg border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tile.url}
                alt=""
                className="size-full object-cover"
              />
              {pendingIds.has(tile.id) && (
                <span className="absolute inset-x-0 bottom-0 bg-background/90 px-1 py-0.5 text-center text-[10px] font-medium text-muted-foreground">
                  Queued
                </span>
              )}
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete photo"
                  className="absolute right-1 top-1 shrink-0 rounded-md bg-background/80 p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleDelete(tile.id)}
                  disabled={uploading && deletingId === tile.id}
                >
                  {uploading && deletingId === tile.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <X className="size-4" />
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No photos yet — add equipment or issue shots.
        </p>
      )}
    </div>
  )
}
