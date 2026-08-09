/**
 * Marks whether the current tenant has already had its dashboard routes
 * warmed into the SW cache on this browser, so `<AppPrecacheGate>` only shows
 * the blocking download screen once per (tenant, route-manifest version)
 * instead of on every page load. Bump `PRECACHE_VERSION` if the manifest in
 * `precache-routes.ts` changes in a way that needs a re-download.
 *
 * `client-only`, all no-ops outside the browser — same idiom as
 * `company-id.ts`.
 */
import "client-only";

const PRECACHE_VERSION = "v1";

function markerKey(companyId: string | null): string {
  return `poolbench:precached:${companyId ?? "none"}:${PRECACHE_VERSION}`;
}

export function hasPrecached(companyId: string | null): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(markerKey(companyId)) !== null;
}

export function markPrecached(companyId: string | null): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(markerKey(companyId), "1");
}
