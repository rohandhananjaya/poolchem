"use client";

import { useEffect, useState } from "react";
import { Droplets } from "lucide-react";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { precacheRoutes } from "@/lib/offline/app-precache";
import { hasPrecached, markPrecached } from "@/lib/offline/precache-marker";
import { getPrecacheRoutes } from "@/lib/offline/precache-routes";
import type { UserRole } from "@/generated/prisma/client";

/**
 * Blocks the dashboard behind a 0–100% download screen the first time a
 * tenant loads the app on this browser, warming every static-shape dashboard
 * route (`precache-routes.ts`) into the SW's runtime cache so navigating to a
 * page the tech hasn't actually visited yet still resolves offline instead of
 * hitting the SW's navigation fallback.
 *
 * Renders `children` immediately (no blocking screen) once the marker is
 * already set for this tenant, or if the device is already offline — there's
 * nothing to download, and whatever got cached on a prior online visit is
 * what the offline surfaces already fall back to.
 */
export function AppPrecacheGate({
  role,
  companyId,
  children,
}: {
  role: UserRole;
  companyId: string | null;
  children: React.ReactNode;
}) {
  const { online, hydrated } = useOnlineStatus();
  const [progress, setProgress] = useState(0);
  const [downloaded, setDownloaded] = useState(false);

  const needsDownload =
    hydrated && online && !downloaded && !hasPrecached(companyId);

  useEffect(() => {
    if (!needsDownload) return;

    let cancelled = false;

    const run = async () => {
      try {
        await navigator.serviceWorker?.ready;
      } catch {
        // No SW available (e.g. a LAN-IP dev origin) — still worth warming
        // the browser's own HTTP cache.
      }
      if (cancelled) return;

      await precacheRoutes(getPrecacheRoutes(role), ({ completed, total }) => {
        if (!cancelled) setProgress(Math.round((completed / total) * 100));
      });
      if (cancelled) return;

      markPrecached(companyId);
      setDownloaded(true);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [needsDownload, role, companyId]);

  if (needsDownload) return <AppDownloadScreen progress={progress} />;

  return <>{children}</>;
}

function AppDownloadScreen({ progress }: { progress: number }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-gradient-to-b from-sky-100 to-teal-200/60 text-teal-600 dark:from-sky-950/40 dark:to-teal-900/40 dark:text-teal-300">
        <Droplets className="size-8" />
      </div>
      <div className="w-full max-w-xs">
        <p className="text-sm font-medium text-foreground">
          Getting Poolbench ready…
        </p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-teal-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 font-mono text-xs tabular-nums text-muted-foreground">
          {progress}%
        </p>
      </div>
    </div>
  );
}
