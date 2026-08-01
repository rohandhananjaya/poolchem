import { describe, expect, it } from "vitest";

import {
  ALLOWED_LOGO_MIME_TYPES,
  MAX_LOGO_BYTES,
  extensionForMimeType,
  validateLogoFile,
} from "./logo-validation";

function fileOfSize(size: number, type: string): File {
  return new File([new Uint8Array(size)], "logo", { type });
}

describe("validateLogoFile", () => {
  it.each(ALLOWED_LOGO_MIME_TYPES)("accepts a %s file within the size cap", (type) => {
    expect(validateLogoFile(fileOfSize(1024, type))).toEqual({ ok: true });
  });

  it("accepts a file exactly at the size cap", () => {
    expect(validateLogoFile(fileOfSize(MAX_LOGO_BYTES, "image/png"))).toEqual({
      ok: true,
    });
  });

  it("rejects a file over the size cap", () => {
    const result = validateLogoFile(fileOfSize(MAX_LOGO_BYTES + 1, "image/png"));
    expect(result.ok).toBe(false);
  });

  it("rejects a zero-byte file", () => {
    const result = validateLogoFile(fileOfSize(0, "image/png"));
    expect(result.ok).toBe(false);
  });

  it("rejects SVG", () => {
    const result = validateLogoFile(fileOfSize(1024, "image/svg+xml"));
    expect(result.ok).toBe(false);
  });

  it("rejects an unrecognized mime type", () => {
    const result = validateLogoFile(fileOfSize(1024, "application/pdf"));
    expect(result.ok).toBe(false);
  });
});

describe("extensionForMimeType", () => {
  it("maps known mime types to extensions", () => {
    expect(extensionForMimeType("image/png")).toBe("png");
    expect(extensionForMimeType("image/jpeg")).toBe("jpg");
    expect(extensionForMimeType("image/webp")).toBe("webp");
  });

  it("falls back to bin for an unrecognized mime type", () => {
    expect(extensionForMimeType("application/pdf")).toBe("bin");
  });
});
