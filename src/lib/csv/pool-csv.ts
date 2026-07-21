/**
 * Pure CSV <-> Pool mapping and validation. No Prisma import, no I/O — the
 * same "pure domain logic" shape as {@link "@/lib/pool-chemistry"}, kept
 * separate so a single CSV row can be validated in isolation and unit-tested
 * without mocking anything.
 */
import { z } from "zod/v4";

import type { CreatePoolData } from "@/lib/db/pools";
import type { Pool } from "@/generated/prisma/client";

/** Canonical import columns, in the order a CSV template should present them. */
export const POOL_CSV_IMPORT_COLUMNS = [
  "name",
  "volume",
  "address",
  "homeownerEmail",
  "homeownerPhone",
  "notes",
] as const;

/** Export includes the import columns plus a couple of read-only ones. */
export const POOL_CSV_EXPORT_COLUMNS = [
  ...POOL_CSV_IMPORT_COLUMNS,
  "isActive",
  "createdAt",
] as const;

type ImportColumn = (typeof POOL_CSV_IMPORT_COLUMNS)[number];

/** Recognizes a header regardless of case/surrounding whitespace. */
const HEADER_ALIASES: Record<string, ImportColumn> = Object.fromEntries(
  POOL_CSV_IMPORT_COLUMNS.map((column) => [column.toLowerCase(), column]),
);

/** Required import columns — a CSV missing either is rejected before any row is read. */
export const REQUIRED_IMPORT_COLUMNS: ImportColumn[] = ["name", "volume"];

const rowSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  volume: z
    .string()
    .trim()
    .refine((v) => Number.isInteger(Number(v)) && Number(v) > 0, {
      message: "volume must be a positive whole number",
    }),
  address: z.string().trim().optional(),
  homeownerEmail: z
    .string()
    .trim()
    .refine((v) => v === "" || z.email().safeParse(v).success, {
      message: "homeownerEmail is not a valid email address",
    })
    .optional(),
  homeownerPhone: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type PoolCsvValidationResult =
  | { ok: true; data: CreatePoolData }
  | { ok: false; error: string };

/**
 * Normalizes a raw CSV row's header keys — trims/lowercases each key and
 * maps it to its canonical column name, ignoring anything unrecognized
 * (e.g. system columns like `id`/`qrCode`/`isActive` that may be present in
 * a previously-exported file being re-imported).
 */
function normalizeRowKeys(raw: Record<string, string>): Partial<Record<ImportColumn, string>> {
  const normalized: Partial<Record<ImportColumn, string>> = {};
  for (const [rawKey, value] of Object.entries(raw)) {
    const column = HEADER_ALIASES[rawKey.trim().toLowerCase()];
    if (column) normalized[column] = value ?? "";
  }
  return normalized;
}

/** Validates one CSV row (already header-parsed into a plain object) into `CreatePoolData`. */
export function parsePoolCsvRow(raw: Record<string, string>): PoolCsvValidationResult {
  const normalized = normalizeRowKeys(raw);
  const parsed = rowSchema.safeParse(normalized);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid row" };
  }

  return {
    ok: true,
    data: {
      name: parsed.data.name,
      volume: Number(parsed.data.volume),
      address: parsed.data.address || null,
      homeownerEmail: parsed.data.homeownerEmail || null,
      homeownerPhone: parsed.data.homeownerPhone || null,
      notes: parsed.data.notes || null,
    },
  };
}

/** Maps `Pool` records to plain, CSV-ready row objects (export side). */
export function poolsToCsvRows(
  pools: Pool[],
): Record<(typeof POOL_CSV_EXPORT_COLUMNS)[number], string | number | boolean>[] {
  return pools.map((pool) => ({
    name: pool.name,
    volume: pool.volume,
    address: pool.address ?? "",
    homeownerEmail: pool.homeownerEmail ?? "",
    homeownerPhone: pool.homeownerPhone ?? "",
    notes: pool.notes ?? "",
    isActive: pool.isActive,
    createdAt: pool.createdAt.toISOString(),
  }));
}
