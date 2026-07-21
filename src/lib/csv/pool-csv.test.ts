import { describe, expect, it } from "vitest";

import { parsePoolCsvRow, poolsToCsvRows } from "./pool-csv";

describe("parsePoolCsvRow", () => {
  it("accepts a valid row", () => {
    const result = parsePoolCsvRow({
      name: "Backyard Pool",
      volume: "15000",
      address: "123 Main St",
      homeownerEmail: "owner@example.com",
      homeownerPhone: "555-1234",
      notes: "Gate code 4321",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        name: "Backyard Pool",
        volume: 15000,
        address: "123 Main St",
        homeownerEmail: "owner@example.com",
        homeownerPhone: "555-1234",
        notes: "Gate code 4321",
      },
    });
  });

  it("accepts a row with only the required columns", () => {
    const result = parsePoolCsvRow({ name: "Minimal Pool", volume: "5000" });

    expect(result).toEqual({
      ok: true,
      data: {
        name: "Minimal Pool",
        volume: 5000,
        address: null,
        homeownerEmail: null,
        homeownerPhone: null,
        notes: null,
      },
    });
  });

  it("rejects a missing name", () => {
    const result = parsePoolCsvRow({ name: "", volume: "5000" });
    expect(result).toEqual({ ok: false, error: "name is required" });
  });

  it("rejects a non-numeric volume", () => {
    const result = parsePoolCsvRow({ name: "Pool", volume: "not-a-number" });
    expect(result).toEqual({ ok: false, error: "volume must be a positive whole number" });
  });

  it("rejects a zero volume", () => {
    const result = parsePoolCsvRow({ name: "Pool", volume: "0" });
    expect(result.ok).toBe(false);
  });

  it("rejects a negative volume", () => {
    const result = parsePoolCsvRow({ name: "Pool", volume: "-100" });
    expect(result.ok).toBe(false);
  });

  it("rejects a decimal volume", () => {
    const result = parsePoolCsvRow({ name: "Pool", volume: "100.5" });
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid homeownerEmail", () => {
    const result = parsePoolCsvRow({
      name: "Pool",
      volume: "5000",
      homeownerEmail: "not-an-email",
    });
    expect(result).toEqual({ ok: false, error: "homeownerEmail is not a valid email address" });
  });

  it("matches headers case-insensitively and trims whitespace", () => {
    const result = parsePoolCsvRow({ " Name ": "Pool", "VOLUME": "5000" });
    expect(result).toEqual({
      ok: true,
      data: {
        name: "Pool",
        volume: 5000,
        address: null,
        homeownerEmail: null,
        homeownerPhone: null,
        notes: null,
      },
    });
  });

  it("ignores unrecognized/system columns", () => {
    const result = parsePoolCsvRow({
      id: "pool-1",
      qrCode: "POOL-abc",
      isActive: "true",
      name: "Pool",
      volume: "5000",
    });
    expect(result.ok).toBe(true);
  });
});

describe("poolsToCsvRows", () => {
  it("maps pools to plain export rows", () => {
    const pool = {
      id: "pool-1",
      name: "Pool",
      volume: 10000,
      address: "123 Main St",
      image: null,
      qrCode: "POOL-abc",
      publicToken: "tok",
      homeownerEmail: null,
      homeownerPhone: null,
      notes: null,
      companyId: "company-1",
      isActive: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    const rows = poolsToCsvRows([pool as never]);

    expect(rows).toEqual([
      {
        name: "Pool",
        volume: 10000,
        address: "123 Main St",
        homeownerEmail: "",
        homeownerPhone: "",
        notes: "",
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });
});
