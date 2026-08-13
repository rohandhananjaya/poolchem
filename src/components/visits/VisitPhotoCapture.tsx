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

export interface VisitPhotoCaptureProps {
  visitId: string
  serviceVisitPoolId: string
  photos: Array<{ id: string; url: string }>
  disabled?: boolean
}

export function VisitPhotoCapture({
  visitId,
  serviceVisitPoolId,
  photos,
  disabled = false,
}: VisitPhotoCaptureProps) {
  const [localPhotos, setLocalPhotos] = React.useState(photos)
  const [uploading, startUpload] = React.useTransition()
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    const validation = validatePhotoFile(file)
    if (!validation.ok) {
      toast.error(validation.error)
      return
    }

    startUpload(async () => {
      const fd = new FormData()
      fd.set("photo", file)
      const result = await uploadVisitPhotoAction(
        visitId,
        serviceVisitPoolId,
        fd,
      )
      if (result.ok && result.photo) {
        const photo = result.photo
        setLocalPhotos((prev) => [...prev, { id: photo.id, url: photo.url }])
        toast.success("Photo added.")
      } else {
        toast.error(result.error ?? "Could not upload photo.")
      }
    })
  }

  function handleDelete(id: string) {
    setDeletingId(id)
    startUpload(async () => {
      const result = await deleteVisitPhotoAction(visitId, id)
      if (result.ok) {
        setLocalPhotos((prev) => prev.filter((photo) => photo.id !== id))
      } else {
        toast.error(result.error ?? "Could not delete photo.")
      }
      setDeletingId(null)
    })
  }

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
          ref={inputRef}
          id={`visit-photo-${serviceVisitPoolId}`}
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={handlePick}
          className="sr-only"
        />
      </div>

      {localPhotos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {localPhotos.map((photo) => (
            <div
              key={photo.id}
              className="relative aspect-square overflow-hidden rounded-lg border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt=""
                className="size-full object-cover"
              />
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete photo"
                  className="absolute right-1 top-1 shrink-0 rounded-md bg-background/80 p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleDelete(photo.id)}
                  disabled={uploading && deletingId === photo.id}
                >
                  {uploading && deletingId === photo.id ? (
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
