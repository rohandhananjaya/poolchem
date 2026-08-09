"use client";

import { useEffect } from "react";

import { saveVisitCache } from "@/lib/offline/visit-cache";
import type { CachedVisit } from "@/lib/offline/types";

/**
 * Offline cache warmer for the `/visits/{id}` page.
 *
 * The visit page is a Server Component that can't render offline, so this
 * mirror (fed by the server-rendered page's props) persists the last-observed
 * visit snapshot into IndexedDB. When a `/visits/{id}` navigation then fails
 * offline, `<OfflineRouteView>` reads it back and renders the cached visit
 * instead of a generic "You're offline" page.
 *
 * Renders nothing. Writes are idempotent last-write-wins — the latest rendered
 * snapshot for a (tenant, visit) replaces the previous one.
 */
export function VisitsCacheMirror({ visit }: { visit: CachedVisit }) {
  useEffect(() => {
    void saveVisitCache(visit);
  }, [visit]);

  return null;
}
