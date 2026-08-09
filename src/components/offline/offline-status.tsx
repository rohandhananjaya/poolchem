"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Home, RefreshCw, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { DEFAULT_REPLAY } from "@/hooks/use-visit-sync-status";
import { getCachedCompanyId } from "@/lib/offline/company-id";
import { getStats } from "@/lib/offline/mutation-queue";
import { drainOnce } from "@/lib/offline/processor";
import type { QueueStats } from "@/lib/offline/mutation-queue";

/**
 * Offline-specific UI for the `/offline` page: pending-mutation count, a Retry
 * button that drains the mutation queue once connectivity returns, and a
 * dashboard link. Rendered as a client component because it reads Dexie.
 *
 * The page this lives on is served by the service worker's navigation fallback
 * (and statically at `/offline` when online), so it can't call `requireTech()` —
 * tenant scoping comes from `getCachedCompanyId()` (mirrored into localStorage
 * by the dashboard layout).
 */
export function OfflineStatus() {
  const { online, hydrated } = useOnlineStatus();
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [draining, setDraining] = useState(false);

  const loadStats = useCallback(async () => {
    const companyId = getCachedCompanyId();
    return companyId ? getStats(companyId) : null;
  }, []);

  // Refresh when coming back online (and once after hydration) so the pending
  // count reflects the current queue. Uses `.then(setStats)` (not `refresh()`)
  // so no setState runs synchronously in the effect
  // (`react-hooks/set-state-in-effect`).
  useEffect(() => {
    if (!hydrated) return;
    void loadStats().then(setStats);
  }, [loadStats, hydrated, online]);

  const retry = useCallback(async () => {
    const companyId = getCachedCompanyId();
    if (!companyId || !online) return;
    setDraining(true);
    try {
      await drainOnce(companyId, DEFAULT_REPLAY);
      setStats(await loadStats());
    } finally {
      setDraining(false);
    }
  }, [online, loadStats]);

  const pendingCount = stats ? stats.pending + stats.failed + stats.dead : 0;

  return (
    <div className="mt-6 w-full">
      {stats && pendingCount > 0 ? (
        <p className="text-sm font-medium text-foreground">
          {pendingCount} change{pendingCount === 1 ? "" : "s"} waiting to sync
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={retry} disabled={!online || draining}>
          <RefreshCw className={draining ? "animate-spin" : undefined} />
          {draining ? "Syncing…" : "Retry"}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">
            <Home />
            Go to dashboard
          </Link>
        </Button>
      </div>

      {!online ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <WifiOff className="size-3.5" />
          Retry activates once you reconnect.
        </p>
      ) : null}
    </div>
  );
}
