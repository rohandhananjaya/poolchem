import { describe, expect, it, afterEach } from "vitest";

import { buildScanUrl, normalizeScanCode } from "@/lib/scan-code";

describe("buildScanUrl", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("builds a deep link rooted at NEXT_PUBLIC_APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://poolbench.com";

    expect(buildScanUrl("POOL-abc")).toBe(
      "https://poolbench.com/scan?code=POOL-abc",
    );
  });

  it("strips a trailing slash from the origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://poolbench.com/";

    expect(buildScanUrl("POOL-abc")).toBe(
      "https://poolbench.com/scan?code=POOL-abc",
    );
  });

  it("falls back to the local origin", () => {
    expect(buildScanUrl("POOL-abc")).toMatch(/^https:\/\/localhost:3000\/scan\?code=/);
  });

  it("URL-encodes the code", () => {
    expect(buildScanUrl("POOL-a b")).toContain("code=POOL-a%20b");
  });
});

describe("normalizeScanCode", () => {
  it("passes a raw pool QR code through", () => {
    expect(normalizeScanCode("POOL-abc-123")).toBe("POOL-abc-123");
  });

  it("passes a pool id through", () => {
    expect(normalizeScanCode("c9j8k7l6m5n4b3v2c1x9z8y7w")).toBe(
      "c9j8k7l6m5n4b3v2c1x9z8y7w",
    );
  });

  it("extracts the code from an https deep link", () => {
    expect(
      normalizeScanCode("https://poolbench.com/scan?code=POOL-abc&foo=1"),
    ).toBe("POOL-abc");
  });

  it("extracts the code from a custom poolbench:// scheme deep link", () => {
    expect(normalizeScanCode("poolbench://scan?code=POOL-abc")).toBe("POOL-abc");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeScanCode("  POOL-abc  ")).toBe("POOL-abc");
  });

  it("returns null for empty input", () => {
    expect(normalizeScanCode("")).toBeNull();
    expect(normalizeScanCode("   ")).toBeNull();
  });

  it("returns null for a URL without a code param", () => {
    expect(normalizeScanCode("https://poolbench.com/scan")).toBeNull();
  });

  it("returns null for an unrelated URL", () => {
    expect(normalizeScanCode("https://example.com/pools/123")).toBeNull();
  });

  it("returns null for a non-pool scheme", () => {
    expect(normalizeScanCode("mailto:test@example.com")).toBeNull();
  });

  it("returns null for junk text", () => {
    expect(normalizeScanCode("hello world")).toBeNull();
    expect(normalizeScanCode("not-a-code!")).toBeNull();
  });

  it("returns null for a short or unsafe raw code", () => {
    expect(normalizeScanCode("short")).toBeNull();
    expect(normalizeScanCode("bad code with spaces and !!" )).toBeNull();
  });
});
