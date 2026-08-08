/**
 * Pure sync-status derivation for the offline visit flow — no I/O.
 *
 * Maps a visit's queue counts + connectivity + processor activity onto a
 * single human-facing `SyncStatus` the visit form can badge and toast. Kept
 * deliberately free of Tailwind/lucide so the UI layer owns presentation; this
 * module only decides the state and its label/tone.
 */

/** Human-facing sync state for one visit. */
export type SyncStatus = "offline" | "pending" | "syncing" | "failed" | "synced";

/** Per-visit queue counts that drive the status. */
export interface VisitSyncStats {
  pending: number;
  failed: number;
  dead: number;
}

/** External signals the derivation needs beyond the counts themselves. */
export interface DeriveSyncStatusOptions {
  /** Whether the device is connected. */
  online: boolean;
  /** Whether a queue sweep is currently in flight (tenant-wide). */
  inFlight: boolean;
}

/** Semantic tone for a status — the UI maps this to icon + color. */
export type SyncTone = "muted" | "amber" | "blue" | "emerald" | "destructive";

/** Label + tone metadata for each status (presentation-agnostic). */
export const SYNC_STATUS_META: Record<
  SyncStatus,
  { label: string; tone: SyncTone }
> = {
  offline: { label: "Offline", tone: "muted" },
  pending: { label: "Pending", tone: "amber" },
  syncing: { label: "Syncing", tone: "blue" },
  synced: { label: "Synced", tone: "emerald" },
  failed: { label: "Sync failed", tone: "destructive" },
};

/**
 * Derives a visit's sync status from its queue counts and connectivity.
 *
 * Precedence (highest wins):
 * 1. `failed` — a queued change is stuck (failed or dead-lettered).
 * 2. `syncing` — a sweep is in flight and this visit still has queued work.
 * 3. `pending` — queued work awaiting a sweep while online.
 * 4. `offline` — queued work while offline (can't sync until connected).
 * 5. `synced` — nothing unsynced.
 *
 * `inFlight` is tenant-wide (sweeps drain the whole tenant queue), so the badge
 * only claims `syncing` when this visit actually has pending entries too.
 */
export function deriveSyncStatus(
  stats: VisitSyncStats,
  opts: DeriveSyncStatusOptions,
): SyncStatus {
  if (stats.failed > 0 || stats.dead > 0) return "failed";
  if (opts.inFlight && stats.pending > 0) return "syncing";
  if (stats.pending > 0) return opts.online ? "pending" : "offline";
  return "synced";
}
