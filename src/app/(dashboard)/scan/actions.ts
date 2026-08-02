"use server";

import { requireActivePackage } from "@/lib/auth";
import { getPoolById, getPoolByQR } from "@/lib/db/pools";
import { createVisit } from "@/lib/db/visits";
import { normalizeScanCode } from "@/lib/scan-code";
import type { Pool } from "@/generated/prisma/client";

/**
 * Resolves a scanned/typed value into a pool owned by `companyId`, or `null`.
 *
 * The value may be a raw `POOL-…` code, a pool id, or the deep-link URL a pool's
 * QR code encodes (`{origin}/scan?code=…`) — see {@link normalizeScanCode}.
 * `getPoolByQR` is not company-scoped, so ownership is verified against the
 * acting company before the result is trusted.
 */
async function resolvePoolForCompany(
  code: string,
  companyId: string,
): Promise<Pool | null> {
  const normalized = normalizeScanCode(code);
  if (!normalized) return null;

  const byQr = await getPoolByQR(normalized);
  if (byQr && byQr.companyId === companyId) return byQr;
  return getPoolById(normalized, companyId);
}

/** Result of validating a scanned/typed code into a pool summary. */
export type LookupPoolResult =
  | { ok: true; pool: { id: string; name: string; address: string | null } }
  | { ok: false; reason: "not-found" };

/**
 * Validates a scanned/typed code and returns the matching pool — WITHOUT
 * creating a visit. Used to drive the scan page's confirmation step, so a code
 * is verified (and shown to the tech) before a visit is ever created.
 */
export async function lookupPoolFromScan(
  code: string,
): Promise<LookupPoolResult> {
  const user = await requireActivePackage();
  if (!user.companyId) {
    return { ok: false, reason: "not-found" };
  }

  const pool = await resolvePoolForCompany(code, user.companyId);
  if (!pool) {
    return { ok: false, reason: "not-found" };
  }

  return {
    ok: true,
    pool: { id: pool.id, name: pool.name, address: pool.address },
  };
}

/** Result of resolving a scanned/typed code into a startable visit. */
export type StartVisitResult =
  | { ok: true; visitId: string }
  | { ok: false; reason: "not-found" };

/**
 * Resolves a scanned QR value (or a manually-typed pool identifier) into a new
 * DRAFT visit for the current tech, then hands back the visit id for the client
 * to navigate to.
 *
 * Accepts a raw `POOL-…` code, a pool id, or the deep-link URL a pool's QR code
 * encodes. Matches are constrained to the acting user's company, so a code
 * belonging to another tenant reads as "not found".
 */
export async function startVisitFromScan(
  code: string,
): Promise<StartVisitResult> {
  const user = await requireActivePackage();
  if (!user.companyId) {
    return { ok: false, reason: "not-found" };
  }

  const pool = await resolvePoolForCompany(code, user.companyId);
  if (!pool) {
    return { ok: false, reason: "not-found" };
  }

  const visit = await createVisit(pool.id, user.id, user.companyId);
  return { ok: true, visitId: visit.id };
}
