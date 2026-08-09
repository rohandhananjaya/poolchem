/**
 * Client-side cache of the last-observed `/pools` list snapshot.
 *
 * The pools page is a Server Component — it can't render without a server
 * round-trip, so when a navigation to `/pools` fails offline the app falls back
 * to the offline route view. This module persists the pools the tech last saw
 * (mirrored by `<PoolsCacheMirror>`, which is fed by the server-rendered page)
 * so that fallback can show real pool rows instead of a bare "You're offline"
 * page.
 *
 * One row per tenant (`&companyId`), captured as a JSON-safe snapshot. Reads are
 * deliberately last-write-wins and best-effort — a stale snapshot beats no
 * snapshot; freshness is a nicety, not a correctness concern.
 */
import "client-only";

import type { CachedPool, PoolCacheSnapshot } from "./types";
import { db } from "./db";

/**
 * Upserts a tenant's `/pools` snapshot, stamping `cachedAt` at write time.
 * One row per tenant — a newer render simply replaces the previous snapshot.
 */
export async function savePoolCache(
  companyId: string,
  pools: CachedPool[],
  total: number,
): Promise<void> {
  await db.poolCache.put({ companyId, pools, total, cachedAt: Date.now() });
}

/**
 * Reads a tenant's cached `/pools` snapshot, or `null` when none has been
 * captured yet (e.g. the pools page was never visited on this device).
 */
export async function getPoolCache(
  companyId: string,
): Promise<PoolCacheSnapshot | null> {
  return (await db.poolCache.get(companyId)) ?? null;
}

/**
 * Removes a tenant's cached snapshot. Wired into `clearCompanyData` so a
 * sign-out / tenant switch never leaks one company's pools to the next session.
 */
export async function clearPoolCache(companyId: string): Promise<void> {
  await db.poolCache.delete(companyId);
}
