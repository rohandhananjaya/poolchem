"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import {
  createPool,
  updatePool,
  deletePool,
  getPoolById,
  getPoolCount,
  createPoolsBulk,
  getAllPoolsForExport,
  type CreatePoolData,
} from "@/lib/db/pools";
import { getCompanyPackage } from "@/lib/db/packages";
import { hasPoolCapacity, checkFeatureAccess, isTrialExpired } from "@/lib/package-features";
import { formText, formOptionalText } from "@/lib/utils";
import { parsePoolCsvRow, poolsToCsvRows, REQUIRED_IMPORT_COLUMNS } from "@/lib/csv/pool-csv";

const text = formText;
const optionalText = formOptionalText;

export interface FormState {
  ok: boolean;
  error?: string;
}

export async function createPoolAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireOwner();
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation." };
  }

  const name = formText(formData, "name");
  if (name === "") return { ok: false, error: "Pool name is required." };

  const volumeRaw = formData.get("volume");
  const volume =
    typeof volumeRaw === "string" ? Number.parseInt(volumeRaw, 10) : NaN;
  if (Number.isNaN(volume) || volume < 1) {
    return { ok: false, error: "Volume must be a positive number." };
  }

  const [companyPackage, poolCount] = await Promise.all([
    getCompanyPackage(user.companyId),
    getPoolCount(user.companyId),
  ]);
  if (!companyPackage || !hasPoolCapacity(companyPackage, poolCount)) {
    const max = companyPackage?.package?.features.max_pools;
    return {
      ok: false,
      error:
        typeof max === "number"
          ? `Your plan allows up to ${max} pools — upgrade to add more.`
          : "Choose a plan to add pools.",
    };
  }

  try {
    await createPool(
      {
        name,
        volume,
        address: formOptionalText(formData, "address"),
        notes: formOptionalText(formData, "notes"),
      },
      user.companyId,
    );
    revalidatePath("/pools");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not create pool. Please try again." };
  }
}

export async function updatePoolAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireOwner();
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation." };
  }

  const poolId = formText(formData, "poolId");
  if (!poolId) return { ok: false, error: "Pool ID is required." };

  const name = formText(formData, "name");
  if (name === "") return { ok: false, error: "Pool name is required." };

  const volumeRaw = formData.get("volume");
  const volume =
    typeof volumeRaw === "string" ? Number.parseInt(volumeRaw, 10) : NaN;
  if (Number.isNaN(volume) || volume < 1) {
    return { ok: false, error: "Volume must be a positive number." };
  }

  const isActive = formData.get("isActive") === "on";

  try {
    await updatePool(poolId, {
      name,
      volume,
      address: formOptionalText(formData, "address"),
      notes: formOptionalText(formData, "notes"),
      isActive,
    }, user.companyId);
    revalidatePath("/pools");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not update pool. Please try again." };
  }
}

export async function deletePoolAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireOwner();
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation." };
  }

  const poolId = formText(formData, "poolId");
  if (!poolId) return { ok: false, error: "Pool ID is required." };

  const confirmName = formText(formData, "confirmName");

  const pool = await getPoolById(poolId, user.companyId);
  if (!pool) {
    return { ok: false, error: "Pool not found." };
  }

  if (confirmName !== pool.name) {
    return { ok: false, error: "Pool name does not match." };
  }

  try {
    await deletePool(poolId, user.companyId);
    revalidatePath("/pools");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not delete pool. Please try again." };
  }
}

const MAX_IMPORT_ROWS = 500;

export interface ImportPoolsResult {
  ok: boolean;
  error?: string;
  imported: number;
  skipped: { row: number; reason: string }[];
}

/**
 * Bulk-creates pools from a client-parsed CSV. Invalid rows are skipped
 * (not a whole-file rejection) — every row that fails validation, or that
 * doesn't fit the plan's remaining `max_pools` capacity, is reported back
 * with the CSV row number (header = row 1) and a reason.
 */
export async function importPoolsAction(
  fields: string[],
  rows: Record<string, string>[],
): Promise<ImportPoolsResult> {
  const user = await requireOwner();
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation.", imported: 0, skipped: [] };
  }

  const [companyPackage, poolCount] = await Promise.all([
    getCompanyPackage(user.companyId),
    getPoolCount(user.companyId),
  ]);
  if (!companyPackage || !checkFeatureAccess(companyPackage, "csv_import")) {
    return {
      ok: false,
      error: "CSV import is not available on your plan.",
      imported: 0,
      skipped: [],
    };
  }

  const normalizedFields = fields.map((f) => f.trim().toLowerCase());
  const missing = REQUIRED_IMPORT_COLUMNS.filter(
    (required) => !normalizedFields.includes(required.toLowerCase()),
  );
  if (missing.length > 0) {
    return {
      ok: false,
      error: `CSV is missing required column(s): ${missing.join(", ")}.`,
      imported: 0,
      skipped: [],
    };
  }
  if (rows.length === 0) {
    return { ok: false, error: "No data rows found in the CSV.", imported: 0, skipped: [] };
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      error: `CSV has ${rows.length} rows; the maximum per import is ${MAX_IMPORT_ROWS}.`,
      imported: 0,
      skipped: [],
    };
  }

  const onActiveTrial =
    companyPackage.status === "TRIAL" && !isTrialExpired(companyPackage);
  const max = companyPackage.package?.features.max_pools;
  const remaining = onActiveTrial
    ? Infinity
    : max === undefined
      ? 0
      : max === -1
        ? Infinity
        : Math.max(0, max - poolCount);

  const toCreate: CreatePoolData[] = [];
  const skipped: { row: number; reason: string }[] = [];

  rows.forEach((raw, i) => {
    const csvRowNumber = i + 2; // header is row 1, first data row is row 2
    if (toCreate.length >= remaining) {
      skipped.push({ row: csvRowNumber, reason: `Skipped — plan limit of ${max} pools reached.` });
      return;
    }
    const result = parsePoolCsvRow(raw);
    if (!result.ok) {
      skipped.push({ row: csvRowNumber, reason: result.error });
      return;
    }
    toCreate.push(result.data);
  });

  const { created, failed } = await createPoolsBulk(toCreate, user.companyId);
  failed.forEach((f) => skipped.push({ row: f.index + 2, reason: f.error }));

  if (created.length > 0) revalidatePath("/pools");

  return { ok: true, imported: created.length, skipped };
}

export interface ExportPoolsResult {
  ok: boolean;
  error?: string;
  data?: Record<string, string | number | boolean>[];
}

/** Returns the company's pools as plain CSV-ready rows for client-side download. */
export async function exportPoolsAction(): Promise<ExportPoolsResult> {
  const user = await requireOwner();
  if (!user.companyId) {
    return { ok: false, error: "No company affiliation." };
  }

  const companyPackage = await getCompanyPackage(user.companyId);
  if (!companyPackage || !checkFeatureAccess(companyPackage, "csv_import")) {
    return { ok: false, error: "CSV export is not available on your plan." };
  }

  const pools = await getAllPoolsForExport(user.companyId);
  return { ok: true, data: poolsToCsvRows(pools) };
}
