/**
 * Client-side visit read cache (IndexedDB via Dexie) — the offline `/visits/{id}`
 * counterpart to `pool-cache.ts`.
 *
 * Stores one last-observed visit snapshot per tenant per visit so the offline
 * fallback (`<OfflineRouteView>`) can render the visit's header, readings,
 * chemicals, and notes instead of the generic "You're offline" page.
 *
 * All helpers are tenant-scoped by `companyId`; a visit's snapshot can never
 * leak across companies (compound unique key `[companyId+visitId]`).
 */
import { db } from "./db";
import type { CachedVisit } from "./types";

/**
 * Upserts a visit snapshot. One row per tenant per visit — a newer render of
 * the same visit replaces the stored row. Stamps `cachedAt` at save time (the
 * caller's render can't call `Date.now()`). Check + upsert in a single readwrite
 * transaction so two concurrent saves can't race the compound unique key.
 */
export async function saveVisitCache(visit: CachedVisit): Promise<void> {
  const row = { ...visit, cachedAt: Date.now() };
  await db.transaction("rw", db.visitCache, async () => {
    const existing = await db.visitCache
      .where("[companyId+visitId]")
      .equals([visit.companyId, visit.visitId])
      .first();

    if (existing) {
      delete row.id;
      await db.visitCache.update(existing.id!, row);
      return;
    }
    await db.visitCache.add(row);
  });
}

/** Returns a visit's cached snapshot for a tenant, or `null` when none exists. */
export async function getVisitCache(
  companyId: string,
  visitId: string,
): Promise<CachedVisit | null> {
  return (
    (await db.visitCache
      .where("[companyId+visitId]")
      .equals([companyId, visitId])
      .first()) ?? null
  );
}

/** Removes a visit's cached snapshot for a tenant. No-op when none exists. */
export async function clearVisitCache(
  companyId: string,
  visitId: string,
): Promise<void> {
  await db.visitCache
    .where("[companyId+visitId]")
    .equals([companyId, visitId])
    .delete();
}
