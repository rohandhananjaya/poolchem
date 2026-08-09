/**
 * Per-tenant "last synced" bookmark for the offline layer.
 *
 * The queue processor (or any successful drain) stamps `setLastSyncedAt` so the
 * offline banner can show a human "Last synced <time>" while offline. One row
 * per tenant, keyed on `companyId` (see `syncMeta` in `db.ts`).
 *
 * `client-only` transitively via `./db` — IndexedDB exists only in the browser
 * / Capacitor WebView.
 */
import { db } from "./db";
import type { SyncMeta } from "./types";

/**
 * Records a successful sync for a tenant. `at` defaults to now; pass an explicit
 * epoch-ms to backdate (e.g. replaying a persisted sweep timestamp on load).
 */
export async function setLastSyncedAt(
  companyId: string,
  at: number = Date.now(),
): Promise<void> {
  const row: SyncMeta = { companyId, lastSyncedAt: at };
  await db.syncMeta.put(row);
}

/**
 * Returns the tenant's last successful sync epoch-ms, or `null` when the tenant
 * has never synced (or was cleared).
 */
export async function getLastSyncedAt(companyId: string): Promise<number | null> {
  const row = await db.syncMeta.get(companyId);
  return row?.lastSyncedAt ?? null;
}
