/**
 * Pure format rules for visit-photo uploads. No I/O — safe to import from
 * both a Server Action and a Client Component.
 */

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