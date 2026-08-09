"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { setCachedCompanyId } from "@/lib/offline/company-id";

/**
 * Top-level nav destinations the SW's runtime cache covers once visited.
 * Warming them while idle (and online) means an offline SPA navigation to a
 * previously-visited page resolves from the SW cache instead of erroring.
 */
const NAV_ROUTES = ["/dashboard", "/schedule", "/pools", "/reports"] as const;

/**
 * Idle-time router-cache warmer.
 *
 * 1. Mirrors the tenant the dashboard layout resolved into localStorage so the
 *    `/offline` page and offline banner can scope mutation-queue stats without
 *    a `requireTech()` call (the SW fallback page can't auth).
 * 2. Prefetches the main nav routes during idle periods (requestIdleCallback,
 *    falling back to a timeout) so their RSC payloads land in the router + SW
 *    caches while the connection is good.
 *
 * Renders nothing.
 */
export function IdleRoutePrefetch({
  companyId,
}: {
  companyId: string | null;
}) {
  const router = useRouter();
  const { online, hydrated } = useOnlineStatus();

  useEffect(() => {
    if (companyId) setCachedCompanyId(companyId);
  }, [companyId]);

  useEffect(() => {
    if (!online || !hydrated) return;
    let cancelled = false;

    const prefetch = async () => {
      // Prefetching against a still-activating SW risks racing it; wait for
      // readiness when a SW is present (no-op otherwise, e.g. LAN dev).
      try {
        await navigator.serviceWorker?.ready;
      } catch {
        // Ignore — prefetch can still warm the browser cache.
      }
      if (cancelled) return;
      for (const route of NAV_ROUTES) {
        if (cancelled) return;
        router.prefetch(route);
      }
    };

    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(prefetch, { timeout: 5000 });
      } else {
        window.setTimeout(prefetch, 3000);
      }
    };
    const idle = window.setTimeout(schedule, 1500);

    return () => {
      cancelled = true;
      window.clearTimeout(idle);
    };
  }, [router, online, hydrated]);

  return null;
}
