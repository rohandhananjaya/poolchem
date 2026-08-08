import { afterEach, describe, expect, it, vi } from "vitest";

import {
  computeNextRetryAt,
  MAX_RETRIES,
  nextDelayMs,
} from "./backoff";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("backoff scheduling", () => {
  it("defaults to 6 max retries", () => {
    expect(MAX_RETRIES).toBe(6);
  });

  it("returns the base delay for the first retry attempt (no jitter at 0.5)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(nextDelayMs(0)).toBe(2000);
  });

  it("doubles the delay each retry attempt", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(nextDelayMs(1)).toBe(4000);
    expect(nextDelayMs(2)).toBe(8000);
    expect(nextDelayMs(3)).toBe(16000);
  });

  it("jitters within ±20%", () => {
    // random 0 → floor (×0.8); random 1 → ceiling (×1.2).
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(nextDelayMs(0)).toBe(1600);
    vi.spyOn(Math, "random").mockReturnValue(1);
    expect(nextDelayMs(0)).toBe(2400);
  });

  it("caps the delay at 5 minutes", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(nextDelayMs(20)).toBe(300000);
  });

  it("honors custom options", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(nextDelayMs(0, { base: 1000, multiplier: 3 })).toBe(1000);
    expect(nextDelayMs(2, { base: 1000, multiplier: 3 })).toBe(9000);
    expect(nextDelayMs(10, { base: 1000, cap: 5000 })).toBe(5000);
  });

  it("clamps negative or fractional attempts to zero", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(nextDelayMs(-2)).toBe(2000);
    expect(nextDelayMs(0.7)).toBe(2000);
  });

  it("computeNextRetryAt offsets a reference now by the delay", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(computeNextRetryAt(1_000_000, 0)).toBe(1_002_000);
    expect(computeNextRetryAt(1_000_000, 2)).toBe(1_008_000);
  });
});
