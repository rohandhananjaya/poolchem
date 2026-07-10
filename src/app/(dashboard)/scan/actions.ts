"use server";

import { requireTech } from "@/lib/auth";
import { getPoolById, getPoolByQR } from "@/lib/db/pools";
import { createVisit } from "@/lib/db/visits";

/** Result of resolving a scanned/typed code into a startable visit. */
export type StartVisitResult =
  | { ok: true; visitId: string }
  | { ok: false; reason: "not-found" };

/**
 * Resolves a scanned QR value (or a manually-typed pool identifier) into a new
 * DRAFT visit for the current tech, then hands back the visit id for the client
 * to navigate to.
 *
 * A scanned code is matched first against a pool's globally-unique `qrCode`, and
 * failing that against a pool id — but always constrained to the acting user's
 * company, so a code belonging to another tenant reads as "not found".
 */
export async function startVisitFromScan(
  code: string,
): Promise<StartVisitResult> {
  const user = await requireTech();
  if (!user.companyId) {
    return { ok: false, reason: "not-found" };
  }

  const trimmed = code.trim();
  if (!trimmed) {
    return { ok: false, reason: "not-found" };
  }

  // Try the QR code first (the common path), then fall back to a raw pool id.
  // getPoolByQR is not company-scoped, so verify ownership before trusting it.
  const byQr = await getPoolByQR(trimmed);
  const pool =
    byQr && byQr.companyId === user.companyId
      ? byQr
      : await getPoolById(trimmed, user.companyId);

  if (!pool) {
    return { ok: false, reason: "not-found" };
  }

  const visit = await createVisit(pool.id, user.id, user.companyId);
  return { ok: true, visitId: visit.id };
}
