"use client";

import { useEffect, useRef, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { CalendarDays, Droplets, Waves, WifiOff } from "lucide-react";

import { PoolRow } from "@/components/pools/PoolRow";
import { OfflineStatus } from "@/components/offline/offline-status";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { getCachedCompanyId } from "@/lib/offline/company-id";
import { getPoolCache } from "@/lib/offline/pool-cache";
import { getVisitCache } from "@/lib/offline/visit-cache";
import { getDraft } from "@/lib/offline/draft-visits";
import type {
  CachedVisit,
  OfflineChemical,
  OfflineDraftVisit,
  OfflineReadings,
  PoolCacheSnapshot,
} from "@/lib/offline/types";

/**
 * Unified offline fallback for the app.
 *
 * Served by two entry points: the precached `/offline` page (the service
 * worker's navigation fallback for an offline full document load) and the root
 * `error.tsx`'s offline branch (a dropped RSC request). Both render the same
 * component so the offline experience is consistent everywhere.
 *
 * When the device is offline on `/pools` (or `/pools/…`) and a cached snapshot
 * exists (see `<PoolsCacheMirror>`), it renders the saved pool rows; on
 * `/visits/{id}` with a cached snapshot (see `<VisitsCacheMirror>`) it renders
 * the saved visit (overlaid with any local draft edits) — "show what you have
 * so far". Otherwise it falls back to the standard offline page. Once
 * connectivity returns, the view reloads the page so the real data replaces the
 * cached copy.
 *
 * Tenant scoping comes from `getCachedCompanyId()` (mirrored into localStorage
 * by the dashboard layout) because the SW-served fallback page can't call
 * `requireTech()`.
 */
export function OfflineRouteView() {
  const { online, hydrated } = useOnlineStatus();
  const [poolSnapshot, setPoolSnapshot] = useState<
    PoolCacheSnapshot | null | undefined
  >(undefined);
  const [visitSnapshot, setVisitSnapshot] = useState<
    CachedVisit | null | undefined
  >(undefined);
  const [draft, setDraft] = useState<OfflineDraftVisit | null | undefined>(
    undefined,
  );

  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "";

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
    if (!companyId) return;
    const route = getOfflineRoute(pathname);
    if (route.type === "pools") {
      void getPoolCache(companyId).then(setPoolSnapshot);
    } else if (route.type === "visits") {
      void getVisitCache(companyId, route.visitId).then(setVisitSnapshot);
      void getDraft(companyId, route.visitId).then(setDraft);
    }
  }, [hydrated, pathname]);

  const route = getOfflineRoute(pathname);

  const hasCachedPools =
    poolSnapshot !== undefined &&
    poolSnapshot !== null &&
    poolSnapshot.pools.length > 0;
  const hasCachedVisit =
    visitSnapshot !== undefined && visitSnapshot !== null;

  if (route.type === "pools" && hasCachedPools) {
    return <CachedPoolsView snapshot={poolSnapshot} />;
  }
  if (route.type === "visits" && hasCachedVisit) {
    return <CachedVisitView snapshot={visitSnapshot} draft={draft ?? null} />;
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

/** Label + badge classes for a visit status — mirrors `visits/[visitId]/page.tsx`. */
function visitStatusMeta(status: string): { label: string; className: string } {
  if (status === "COMPLETED") {
    return {
      label: "Completed",
      className:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    };
  }
  if (status === "IN_PROGRESS") {
    return {
      label: "In Progress",
      className:
        "bg-brand-50 text-brand-900 dark:bg-brand-900 dark:text-brand-200",
    };
  }
  if (status === "CANCELLED") {
    return {
      label: "Cancelled",
      className: "bg-muted text-muted-foreground",
    };
  }
  return {
    label: "Scheduled",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  };
}

const READING_ROWS: Array<{ key: keyof OfflineReadings; label: string }> = [
  { key: "ph", label: "pH" },
  { key: "freeChlorine", label: "Free chlorine" },
  { key: "totalAlkalinity", label: "Total alkalinity" },
  { key: "calciumHardness", label: "Calcium hardness" },
  { key: "cyanuricAcid", label: "Cyanuric acid" },
  { key: "temperature", label: "Temperature" },
];

/**
 * Merges the cached visit's readings with any local draft edits so the offline
 * view shows the tech's latest entered values (draft wins per field).
 */
function mergedReadings(
  cached: CachedVisit,
  draft: OfflineDraftVisit | null,
): OfflineReadings {
  const local = draft?.payload.readings ?? {};
  const saved = cached.lastReadings ?? {};
  const merged: OfflineReadings = {};
  for (const { key } of READING_ROWS) {
    const localValue = local[key];
    const savedValue = saved[key];
    if (localValue !== undefined && localValue !== null) merged[key] = localValue;
    else if (savedValue !== undefined && savedValue !== null) merged[key] = savedValue;
  }
  return merged;
}

/**
 * Offline rendering of the last-observed `/visits/{id}` snapshot. Shows a
 * cached-data banner, the visit header (pool name, status, address, volume,
 * scheduled time), the readings/chemicals/notes the form would show (local
 * draft edits override the snapshot), and OfflineStatus actions. Read-only —
 * editing stays on the live page.
 */
function CachedVisitView({
  snapshot,
  draft,
}: {
  snapshot: CachedVisit;
  draft: OfflineDraftVisit | null;
}) {
  const readings = mergedReadings(snapshot, draft);
  const hasReadings = READING_ROWS.some(({ key }) => readings[key] != null);
  const chemicals: OfflineChemical[] =
    draft?.payload.chemicals.length ? draft.payload.chemicals : snapshot.chemicals;
  const notes = draft?.payload.notes?.trim() ? draft.payload.notes : snapshot.notes;
  const status = visitStatusMeta(snapshot.status);

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
        <div className="flex items-center gap-2">
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
            {snapshot.pool.name}
          </h1>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}
          >
            {status.label}
          </span>
        </div>
        {snapshot.pool.address ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {snapshot.pool.address}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            <Droplets className="size-3" />
            {snapshot.pool.volume.toLocaleString()} gal
          </span>
          {snapshot.scheduledAt ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              <CalendarDays className="size-3" />
              {format(new Date(snapshot.scheduledAt), "EEE, MMM d 'at' h:mm a")}
            </span>
          ) : null}
        </div>
        {snapshot.status === "CANCELLED" && snapshot.cancellationReason ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Reason: {snapshot.cancellationReason}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">
          Saved{" "}
          {formatDistanceToNow(snapshot.cachedAt ?? 0, { addSuffix: true })}
        </p>
      </header>

      {hasReadings ? (
        <section className="mb-6 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Water readings
          </h2>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {READING_ROWS.filter(({ key }) => readings[key] != null).map(
              ({ key, label }) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium text-foreground">
                    {readings[key]}
                    {key === "ph" || key === "temperature" ? "" : " ppm"}
                    {key === "temperature" ? "°F" : ""}
                  </dd>
                </div>
              ),
            )}
          </dl>
        </section>
      ) : null}

      {chemicals.length > 0 ? (
        <section className="mb-6 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Chemicals added
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {chemicals.map((chem, i) => (
              <li
                key={`${chem.name}-${i}`}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-muted-foreground">{chem.name}</span>
                <span className="font-medium text-foreground">
                  {chem.amount} {chem.unit}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {notes ? (
        <section className="mb-6 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Notes
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
            {notes}
          </p>
        </section>
      ) : null}

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

/** Resolves the offline fallback's route from the address-bar pathname. */
function getOfflineRoute(
  pathname: string,
): { type: "pools" } | { type: "visits"; visitId: string } | { type: "generic" } {
  if (pathname.startsWith("/pools")) return { type: "pools" };
  const visitsMatch = pathname.match(/^\/visits\/([^/]+)/);
  if (visitsMatch) return { type: "visits", visitId: visitsMatch[1] };
  return { type: "generic" };
}
