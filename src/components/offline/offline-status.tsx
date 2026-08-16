"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Home, RefreshCw, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { DEFAULT_REPLAY } from "@/hooks/use-visit-sync-status";
import { DEFAULT_PHOTO_REPLAY } from "@/hooks/use-photo-queue-processor";
import { getCachedCompanyId } from "@/lib/offline/company-id";
import { getPhotoStats } from "@/lib/offline/photo-queue";
import { getStats } from "@/lib/offline/mutation-queue";
import { drainOnce, drainPhotosOnce } from "@/lib/offline/processor";
import type { QueueStats } from "@/lib/offline/mutation-queue";

/**
 * Offline-specific UI for the `/offline` page: pending mutation + photo counts,
 * a Retry button that drains both queues once connectivity returns, and a
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
  const [photoStats, setPhotoStats] = useState<QueueStats | null>(null);
  const [draining, setDraining] = useState(false);

  const loadStats = useCallback(async () => {
    const companyId = getCachedCompanyId();
    if (!companyId) return { mutation: null as QueueStats | null, photos: null as QueueStats | null };
    const [mutation, photos] = await Promise.all([
      getStats(companyId),
      getPhotoStats(companyId),
    ]);
    return { mutation, photos };
  }, []);

  // Refresh when coming back online (and once after hydration) so the pending
  // counts reflect the current queues. Uses `.then(setState)` (not `refresh()`)
  // so no setState runs synchronously in the effect
  // (`react-hooks/set-state-in-effect`).
  useEffect(() => {
    if (!hydrated) return;
    void loadStats().then((next) => {
      setStats(next.mutation);
      setPhotoStats(next.photos);
    });
  }, [loadStats, hydrated, online]);

  const retry = useCallback(async () => {
    const companyId = getCachedCompanyId();
    if (!companyId || !online) return;
    setDraining(true);
    try {
      const [nextMutation, nextPhotos] = await Promise.all([
        drainOnce(companyId, DEFAULT_REPLAY).then(() => getStats(companyId)),
        drainPhotosOnce(companyId, DEFAULT_PHOTO_REPLAY).then(() =>
          getPhotoStats(companyId),
        ),
      ]);
      setStats(nextMutation);
      setPhotoStats(nextPhotos);
    } finally {
      setDraining(false);
    }
  }, [online]);

  const pendingCount = stats ? stats.pending + stats.failed + stats.dead : 0;
  const photoPendingCount = photoStats
    ? photoStats.pending + photoStats.failed + photoStats.dead
    : 0;

  return (
    <div className="mt-6 w-full">
      {stats && pendingCount > 0 ? (
        <p className="text-sm font-medium text-foreground">
          {pendingCount} change{pendingCount === 1 ? "" : "s"} waiting to sync
        </p>
      ) : null}
      {photoStats && photoPendingCount > 0 ? (
        <p className="text-sm font-medium text-foreground">
          {photoPendingCount} photo{photoPendingCount === 1 ? "" : "s"} waiting
          to sync
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