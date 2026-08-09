import { OfflineRouteView } from "@/components/offline/offline-route-view";

/**
 * Offline fallback page.
 *
 * Prerendered at build so the service worker can precache it (`APP_SHELL_PRECACHE`)
 * and serve it via the navigation fallback when a full document load fails while
 * offline. When online, it's the static page at `/offline` (used by the offline
 * banner's "View" link and the SW's own fallback).
 *
 * Renders `<OfflineRouteView>`, the unified offline fallback: when the service
 * worker serves this page for a `/pools` navigation (the browser's address bar
 * still shows the intended URL), it renders the cached pool snapshot instead of
 * the generic copy. Tenant-scoped data is read client-side (the SW-served copy
 * can't call `requireTech()`).
 */
export const dynamic = "force-static";

export default function OfflinePage() {
  return <OfflineRouteView />;
}
