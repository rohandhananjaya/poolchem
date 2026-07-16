import { describe, expect, it } from "vitest";

const { generateQRDataUrl } = await import("./qr");

describe("generateQRDataUrl", () => {
  it("returns an SVG data URL for a valid URL", async () => {
    const result = await generateQRDataUrl("https://example.com");
    expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("returns different output for different inputs", async () => {
    const a = await generateQRDataUrl("https://example.com");
    const b = await generateQRDataUrl("https://other.com");
    expect(a).not.toBe(b);
  });

  it("contains valid SVG markup when decoded", async () => {
    const result = await generateQRDataUrl("https://example.com");
    const base64 = result.replace(/^data:image\/svg\+xml;base64,/, "");
    const svg = Buffer.from(base64, "base64").toString("utf-8");
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain("</svg>");
    expect(svg).toContain('stroke="#171717"');
  });

  it("handles a long URL without error", async () => {
    const longUrl = "https://poolbench.example.com/pool/tok_abc123def456";
    const result = await generateQRDataUrl(longUrl);
    expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
  });
});
