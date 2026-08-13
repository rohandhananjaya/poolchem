/**
 * Dexie-backed IndexedDB schema for the offline layer.
 *
 * `import "client-only"` guarantees this module is never bundled into a Server
 * Component or Server Action — IndexedDB exists only in the browser / Capacitor
 * WebView, never on the server.
 *
 * Schema: `poolbench-offline`
 * - `draftVisits`   — one draft per visit per tenant (`&[companyId+visitId]`).
 * - `mutationQueue` — unique queue entry per tenant per clientMutationId
 *                     (`&[companyId+clientMutationId]`), FIFO-drainable via
 *                     `[companyId+status]` + `createdAt`.
 * - `syncMeta`      — one last-synced bookmark per tenant (`&companyId`).
 * - `poolCache`     — one last-observed `/pools` snapshot per tenant (`&companyId`).
 * - `visitCache`    — one last-observed visit per tenant per visit
 *                     (`&[companyId+visitId]`).
 *
 * v2 adds `[companyId+visitId]` so per-visit queries (`getVisitStats`,
 * `getPendingForVisit`, …) resolve via the index instead of scanning the whole
 * tenant queue. Added indexes are backfilled automatically on upgrade.
 *
 * v3 adds the `syncMeta` table (drives the offline banner's "last synced"
 * timestamp). The queue/draft schema is unchanged — re-declared verbatim so
 * Dexie keeps those tables (each version must list every table it owns).
 *
 * v4 adds the `poolCache` table (one last-observed `/pools` snapshot per
 * tenant) so the offline fallback can render cached pool rows instead of a
 * generic "You're offline" page.
 *
 * v5 adds the `visitCache` table (one last-observed visit per tenant per
 * visit) so the offline fallback can render a cached visit instead of the
 * generic copy.
 *
 * v6 adds the `photoQueue` table — a Blob-capable queue for offline photo
 * uploads (`QueuedPhoto`), drained by the same sweep engine as the mutation
 * queue. `&[companyId+clientMutationId]` dedupes re-enqueues; the blob is
 * stored via IndexedDB structured clone (survives reloads).
 */
import "client-only";

import Dexie, { type EntityTable } from "dexie";

import type {
  CachedVisit,
  OfflineDraftVisit,
  PoolCacheSnapshot,
  QueuedMutation,
  QueuedPhoto,
  SyncMeta,
} from "./types";

class PoolbenchOfflineDB extends Dexie {
  draftVisits!: EntityTable<OfflineDraftVisit, "id">;
  mutationQueue!: EntityTable<QueuedMutation, "id">;
  syncMeta!: EntityTable<SyncMeta, "companyId">;
  poolCache!: EntityTable<PoolCacheSnapshot, "companyId">;
  visitCache!: EntityTable<CachedVisit, "id">;
  photoQueue!: EntityTable<QueuedPhoto, "id">;

  constructor() {
    super("poolbench-offline");
    this.version(1).stores({
      draftVisits: "++id, &[companyId+visitId], companyId, updatedAt",
      mutationQueue:
        "++id, &[companyId+clientMutationId], companyId, [companyId+status], createdAt",
    });
    this.version(2).stores({
      draftVisits: "++id, &[companyId+visitId], companyId, updatedAt",
      mutationQueue:
        "++id, &[companyId+clientMutationId], companyId, [companyId+status], [companyId+visitId], createdAt",
    });
    this.version(3).stores({
      draftVisits: "++id, &[companyId+visitId], companyId, updatedAt",
      mutationQueue:
        "++id, &[companyId+clientMutationId], companyId, [companyId+status], [companyId+visitId], createdAt",
      syncMeta: "&companyId, lastSyncedAt",
    });
    this.version(4).stores({
      draftVisits: "++id, &[companyId+visitId], companyId, updatedAt",
      mutationQueue:
        "++id, &[companyId+clientMutationId], companyId, [companyId+status], [companyId+visitId], createdAt",
      syncMeta: "&companyId, lastSyncedAt",
      poolCache: "&companyId, cachedAt",
    });
    this.version(5).stores({
      draftVisits: "++id, &[companyId+visitId], companyId, updatedAt",
      mutationQueue:
        "++id, &[companyId+clientMutationId], companyId, [companyId+status], [companyId+visitId], createdAt",
      syncMeta: "&companyId, lastSyncedAt",
      poolCache: "&companyId, cachedAt",
      visitCache: "++id, &[companyId+visitId], companyId, cachedAt",
    });
    this.version(6).stores({
      draftVisits: "++id, &[companyId+visitId], companyId, updatedAt",
      mutationQueue:
        "++id, &[companyId+clientMutationId], companyId, [companyId+status], [companyId+visitId], createdAt",
      syncMeta: "&companyId, lastSyncedAt",
      poolCache: "&companyId, cachedAt",
      visitCache: "++id, &[companyId+visitId], companyId, cachedAt",
      photoQueue:
        "++id, &[companyId+clientMutationId], companyId, [companyId+status], [companyId+visitId], [companyId+serviceVisitPoolId], createdAt",
    });
  }
}

/** The single offline database instance for the app. */
export const db = new PoolbenchOfflineDB();
