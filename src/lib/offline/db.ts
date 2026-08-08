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
 *
 * v2 adds `[companyId+visitId]` so per-visit queries (`getVisitStats`,
 * `getPendingForVisit`, …) resolve via the index instead of scanning the whole
 * tenant queue. Added indexes are backfilled automatically on upgrade.
 */
import "client-only";

import Dexie, { type EntityTable } from "dexie";

import type { OfflineDraftVisit, QueuedMutation } from "./types";

class PoolbenchOfflineDB extends Dexie {
  draftVisits!: EntityTable<OfflineDraftVisit, "id">;
  mutationQueue!: EntityTable<QueuedMutation, "id">;

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
  }
}

/** The single offline database instance for the app. */
export const db = new PoolbenchOfflineDB();
