import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CloudOff,
  Loader2,
  type LucideIcon,
} from "lucide-react";

import {
  SYNC_STATUS_META,
  type SyncStatus,
  type SyncTone,
  type VisitSyncStats,
} from "@/lib/offline/sync-status";
import { cn } from "@/lib/utils";

const TONE_STYLES: Record<SyncTone, string> = {
  muted: "text-muted-foreground",
  amber: "text-amber-600 dark:text-amber-400",
  blue: "text-blue-600 dark:text-blue-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  destructive: "text-destructive",
};

const TONE_ICONS: Record<SyncTone, LucideIcon> = {
  muted: CloudOff,
  amber: Clock,
  blue: Loader2,
  emerald: CheckCircle2,
  destructive: AlertTriangle,
};

/** Queue count worth surfacing next to the label, when provided. */
function countFor(status: SyncStatus, counts?: VisitSyncStats): number | null {
  if (!counts) return null;
  switch (status) {
    case "pending":
    case "offline":
      return counts.pending;
    case "failed":
      return counts.failed + counts.dead;
    default:
      return null;
  }
}

/**
 * Informational sync-status chip for a visit. Presentational: takes the derived
 * `status` (from `useVisitSyncStatus`) and optional per-visit counts, renders
 * the label + status-colored icon. Hidden by callers on completed/other-tech
 * pages where the form is disabled.
 */
export function SyncStatusBadge({
  status,
  counts,
  className,
}: {
  status: SyncStatus;
  counts?: VisitSyncStats;
  className?: string;
}) {
  const meta = SYNC_STATUS_META[status];
  const Icon = TONE_ICONS[meta.tone];
  const count = countFor(status, counts);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium text-foreground",
        className,
      )}
    >
      <Icon
        className={cn(
          "size-3.5",
          TONE_STYLES[meta.tone],
          status === "syncing" && "animate-spin",
        )}
        aria-hidden="true"
      />
      {meta.label}
      {typeof count === "number" && count > 0 ? ` (${count})` : null}
    </span>
  );
}
