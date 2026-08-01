/**
 * Pure validation rules for a company logo upload. No I/O — safe to import
 * from both a Server Action and a Client Component.
 */

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export const ALLOWED_LOGO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type AllowedLogoMimeType = (typeof ALLOWED_LOGO_MIME_TYPES)[number];

export type LogoValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/** Validates a picked logo file's size and mime type. */
export function validateLogoFile(file: File): LogoValidationResult {
  if (file.size === 0) {
    return { ok: false, error: "The selected file is empty." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { ok: false, error: "Logo must be 2MB or smaller." };
  }
  if (!ALLOWED_LOGO_MIME_TYPES.includes(file.type as AllowedLogoMimeType)) {
    return { ok: false, error: "Logo must be a PNG, JPEG, or WebP image." };
  }
  return { ok: true };
}

/** Maps an allowed mime type to a file extension for the stored object key. */
export function extensionForMimeType(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}
