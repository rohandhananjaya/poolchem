import { describe, expect, it } from "vitest";

import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_BYTES,
  extensionForPhotoMimeType,
  validatePhotoFile,
} from "./photo-format";

function makeFile(size: number, type: string): File {
  return new File([new Uint8Array(size)], "photo.bin", { type });
}

describe("photo-format", () => {
  it("caps photos at 6MB", () => {
    expect(MAX_PHOTO_BYTES).toBe(6 * 1024 * 1024);
  });

  it("accepts an empty, allowed-mime photo only when it has bytes", () => {
    const result = validatePhotoFile(makeFile(1024, "image/jpeg"));
    expect(result).toEqual({ ok: true });
  });

  it("rejects a zero-byte photo", () => {
    const result = validatePhotoFile(makeFile(0, "image/jpeg"));
    expect(result).toEqual({ ok: false, error: "The selected photo is empty." });
  });

  it("rejects a photo over 6MB", () => {
    const result = validatePhotoFile(makeFile(MAX_PHOTO_BYTES + 1, "image/jpeg"));
    expect(result).toEqual({ ok: false, error: "Photo must be 6MB or smaller." });
  });

  it("rejects a disallowed mime type", () => {
    const result = validatePhotoFile(makeFile(1024, "image/gif"));
    expect(result).toEqual({
      ok: false,
      error: "Photo must be a JPEG, PNG, or WebP image.",
    });
  });

  it("accepts every allowed mime type", () => {
    for (const mime of ALLOWED_PHOTO_MIME_TYPES) {
      expect(validatePhotoFile(makeFile(1024, mime))).toEqual({ ok: true });
    }
  });

  it("maps allowed mime types to extensions", () => {
    expect(extensionForPhotoMimeType("image/jpeg")).toBe("jpg");
    expect(extensionForPhotoMimeType("image/png")).toBe("png");
    expect(extensionForPhotoMimeType("image/webp")).toBe("webp");
    expect(extensionForPhotoMimeType("image/gif")).toBe("bin");
  });
});
