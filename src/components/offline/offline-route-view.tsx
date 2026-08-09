"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Droplets, Waves, WifiOff } from "lucide-react";

import { PoolRow } from "@/components/pools/PoolRow";
import { OfflineStatus } from "@/components/offline/offline-status";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { getCachedCompanyId } from "@/lib/offline/company-id";
import { getPoolCache } from "@/lib/offline/pool-cache";
import type { PoolCacheSnapshot } from "@/lib/offline/types";

/**
 * Unified offline fallback for the app.
 *
 * Served by two entry points: the precached `/offline` page (the service
 * worker's navigation fallback for an offline full document load) and the root
 * `error.tsx`'s offline branch (a dropped RSC request). Both render the same
 * component so the offline experience is consistent everywhere.
 *
 * When the device is offline on `/pools` (or `/pools/…`) and a cached snapshot
 * exists (see `<PoolsCacheMirror>`), it renders the saved pool rows instead of
 * the generic "You're offline" copy — "show what you have so far". Otherwise it
 * falls back to the standard offline page. Once connectivity returns, the view
 * reloads the page so the real data replaces the cached copy.
 *
 * Tenant scoping comes from `getCachedCompanyId()` (mirrored into localStorage
 * by the dashboard layout) because the SW-served fallback page can't call
 * `requireTech()`.
 */
export function OfflineRouteView() {
  const { online, hydrated } = useOnlineStatus();
  const [snapshot, setSnapshot] = useState<PoolCacheSnapshot | null | undefined>(
    undefined,
  );

  // Reload once connectivity returns so the offline view recovers to the real
  // page. Only fires on the offline→online edge (prevOnline is `null` before
  // the first hydrated read, so a page that loads while already online never
  // reloads).
  const prevOnline = useRef<boolean | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    const wasOnline = prevOnline.current;
    prevOnline.current = online;
    if (wasOnline === false && online) window.location.reload();
  }, [online, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const companyId = getCachedCompanyId();
    void (companyId ? getPoolCache(companyId) : Promise.resolve(null)).then(
      setSnapshot,
    );
  }, [hydrated]);

  const isPoolsRoute =
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/pools");

  const hasCachedPools =
    snapshot !== undefined && snapshot !== null && snapshot.pools.length > 0;

  if (isPoolsRoute && hasCachedPools) {
    return <CachedPoolsView snapshot={snapshot} />;
  }

  return <GenericOfflineView />;
}

/**
 * Offline rendering of the last-observed `/pools` snapshot. Shows a cached-data
 * banner, the saved pool rows (read-only — no edit/delete offline), and the
 * standard OfflineStatus actions (pending-sync count, Retry, dashboard link).
 */
function CachedPoolsView({ snapshot }: { snapshot: PoolCacheSnapshot }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
        <WifiOff className="size-4 shrink-0" />
        <span>
          You&apos;re offline — showing the last saved copy. Reconnect to see
          live data.
        </span>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Pools
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Showing {snapshot.pools.length} saved pool
          {snapshot.pools.length === 1 ? "" : "s"} · saved{" "}
          {formatDistanceToNow(snapshot.cachedAt, { addSuffix: true })}
        </p>
      </header>

      <div className="space-y-3">
        {snapshot.pools.map((pool) => (
          <PoolRow key={pool.id} pool={pool} canManage={false} />
        ))}
      </div>

      <div className="mt-8">
        <OfflineStatus />
      </div>
    </div>
  );
}

/**
 * The generic offline screen (the `/offline` page's content). Shown for every
 * route that has no cached data to offer.
 */
function GenericOfflineView() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex size-32 items-center justify-center rounded-full bg-gradient-to-b from-sky-100 to-teal-200/60 text-teal-600 dark:from-sky-950/40 dark:to-teal-900/40 dark:text-teal-300">
        <Waves className="size-16" />
      </div>
      <h1 className="mt-6 text-xl font-semibold tracking-tight text-foreground">
        You&apos;re offline
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Reconnect to load this page. Your unsaved changes are safe on this
        device and will sync automatically.
      </p>
      <OfflineStatus />
      <p className="mt-8 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Droplets className="size-3.5 text-teal-600 dark:text-teal-400" />
        Poolbench
      </p>
    </div>
  );
}
