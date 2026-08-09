/**
 * Warms the SW's runtime cache for a list of routes so an offline
 * client-side navigation (RSC fetch) and an offline hard navigation/reload
 * (full document fetch) both resolve from cache instead of erroring.
 *
 * `sw-policy.ts`'s runtime caching (via `@serwist/turbopack`'s `defaultCache`)
 * keys its `pages` cache off a `text/html` response and its `pages-rsc` cache
 * off a same-origin GET carrying an `RSC: "1"` header with no
 * `Next-Router-Prefetch` header — the same shape a real Link click issues.
 * Firing one request of each shape per route, instead of relying on
 * `router.prefetch()` (which only warms the *separate* `pages-rsc-prefetch`
 * bucket a real navigation never reads from), is what actually makes the
 * offline navigation cache-hit.
 *
 * `client-only`: fetches against the live origin, only meaningful in the
 * browser. `fetchImpl` is injectable (DIP) so tests don't need a real network
 * or service worker.
 */
import "client-only";

export interface PrecacheProgress {
  completed: number;
  total: number;
  route: string;
}

export interface PrecacheSummary {
  total: number;
  failedRoutes: string[];
}

async function warmRoute(
  route: string,
  fetchImpl: typeof fetch,
): Promise<boolean> {
  try {
    const [document, rsc] = await Promise.all([
      fetchImpl(route),
      fetchImpl(route, { headers: { RSC: "1" } }),
    ]);
    return document.ok && rsc.ok;
  } catch {
    return false;
  }
}

export async function precacheRoutes(
  routes: string[],
  onProgress?: (progress: PrecacheProgress) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<PrecacheSummary> {
  const failedRoutes: string[] = [];
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    const ok = await warmRoute(route, fetchImpl);
    if (!ok) failedRoutes.push(route);
    onProgress?.({ completed: i + 1, total: routes.length, route });
  }
  return { total: routes.length, failedRoutes };
}
