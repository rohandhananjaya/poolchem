/**
 * Pure format rules for visit-photo uploads. No I/O — safe to import from
 * both a Server Action and a Client Component.
 */

export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;

export const ALLOWED_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedPhotoMimeType = (typeof ALLOWED_PHOTO_MIME_TYPES)[number];

export type PhotoValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/** Validates a picked photo file's size and mime type. */
export function validatePhotoFile(file: File): PhotoValidationResult {
  if (file.size === 0) {
    return { ok: false, error: "The selected photo is empty." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "Photo must be 6MB or smaller." };
  }
  if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.type as AllowedPhotoMimeType)) {
    return { ok: false, error: "Photo must be a JPEG, PNG, or WebP image." };
  }
  return { ok: true };
}

/**
 * Maps a photo mime type to a file extension for the stored object key.
 * Kept separate from `logo-validation.ts` so each upload domain stays
 * self-contained (photos may grow their own size/quantity rules here, e.g.
 * MAX_PHOTO_BYTES, once the validation card lands).
 */
export function extensionForPhotoMimeType(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}