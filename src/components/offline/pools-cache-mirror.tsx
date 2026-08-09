"use client";

import { useEffect } from "react";

import { savePoolCache } from "@/lib/offline/pool-cache";
import type { CachedPool } from "@/lib/offline/types";

/**
 * Offline cache warmer for the `/pools` page.
 *
 * The pools page is a Server Component that can't render offline, so this
 * mirror (fed by the server-rendered page's props) persists the last-observed
 * pools snapshot into IndexedDB. When a `/pools` navigation then fails offline,
 * `<OfflineRouteView>` reads it back and renders the cached rows instead of a
 * generic "You're offline" page.
 *
 * Renders nothing. Writes are idempotent last-write-wins — the latest rendered
 * snapshot replaces the previous one.
 */
export function PoolsCacheMirror({
  companyId,
  pools,
  total,
}: {
  companyId: string;
  pools: CachedPool[];
  total: number;
}) {
  useEffect(() => {
    void savePoolCache(companyId, pools, total);
  }, [companyId, pools, total]);

  return null;
}
