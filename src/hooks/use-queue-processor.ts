"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  drainOnce,
  type FlushReplay,
} from "@/lib/offline/processor";
import type { QueuedMutation } from "@/lib/offline/types";
import { useOnlineStatus } from "./use-online-status";

export interface UseQueueProcessorOptions {
  /** Tenant whose queue to drain. */
  companyId: string;
  /** Injected Server Action to replay each due entry against (DIP). */
  replay: FlushReplay;
  /** Maps replay errors to permanent (dead-letter immediately). */
  classifyError?: (err: unknown, entry: QueuedMutation) => boolean;
  /** Fired when an entry dead-letters. */
  onDead?: (entry: QueuedMutation) => void;
  /** Periodic sweep interval in ms. Default 5000. */
  sweepIntervalMs?: number;
  /**
   * When `false`, the processor is dormant: no sweep triggers run and `drain`
   * is a no-op. The visit form disables it on completed/other-tech pages where
   * replaying queued drafts would dead-letter uselessly. Default `true`.
   */
  enabled?: boolean;
}

/**
 * Wires the queue processor's triggers: drains when connectivity returns after
 * hydration, when the tab/WebView regains visibility (covers Capacitor resume
 * and PWA tab return), and on a periodic sweep so entries whose backoff window
 * just elapsed are retried. Gated on `useOnlineStatus` — an offline spell never
 * triggers a sweep, so retry budget is never consumed offline.
 *
 * Returns `drain` for callers to trigger an immediate sweep (e.g. after
 * `retryDead`). The single-flight guard in `drainOnce` prevents overlapping
 * sweeps from the various triggers.
 */
export function useQueueProcessor(options: UseQueueProcessorOptions) {
  const { online, hydrated } = useOnlineStatus();
  const enabled = options.enabled !== false;

  // Latest-value refs so the interval/visibility listeners (registered once)
  // always observe the current options and connectivity. Ref writes happen in
  // effects (not during render) to satisfy react-hooks/refs.
  const optsRef = useRef(options);
  const onlineRef = useRef(online);
  const hydratedRef = useRef(hydrated);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    optsRef.current = options;
  });
  useEffect(() => {
    onlineRef.current = online;
  });
  useEffect(() => {
    hydratedRef.current = hydrated;
  });
  useEffect(() => {
    enabledRef.current = enabled;
  });

  const drain = useCallback(() => {
    if (!enabledRef.current) return;
    if (!onlineRef.current || !hydratedRef.current) return;
    const { companyId, replay, classifyError, onDead } = optsRef.current;
    void drainOnce(companyId, replay, { classifyError, onDead }).catch((e) => {
      console.error("Queue drain failed:", e);
    });
  }, []);

  // Drain once connectivity returns (post-hydration, or on reconnect).
  useEffect(() => {
    if (!enabled || !online || !hydrated) return;
    drain();
  }, [enabled, online, hydrated, drain]);

  // Drain when the tab/WebView returns to the foreground.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (enabledRef.current && document.visibilityState === "visible") {
        drain();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [drain]);

  // Periodic sweep retries entries whose backoff schedule just elapsed.
  // Re-arms when the interval value (or enabled state) changes.
  useEffect(() => {
    if (!enabled) return;
    const sweepIntervalMs = options.sweepIntervalMs ?? 5000;
    const id = window.setInterval(drain, sweepIntervalMs);
    return () => window.clearInterval(id);
  }, [enabled, options.sweepIntervalMs, drain]);

  return { drain };
}
