"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  drainOnce,
  type DrainResult,
} from "@/lib/offline/processor";
import { useOnlineStatus } from "./use-online-status";

/**
 * The callbacks a sweep entry-point accepts — the structural subset of the
 * mutation/photo drain options the hook wires through (now/limit/backoff stay
 * internal to the queue backends).
 */
export interface DrainCallbackOptions<E> {
  classifyError?: (err: unknown, entry: E) => boolean;
  onDead?: (entry: E) => void;
  onSynced?: (entry: E) => void;
  onFailed?: (entry: E, permanent: boolean) => void;
}

/**
 * The sweep entry-point abstraction (DIP). `drainOnce` (mutation queue) and
 * `drainPhotosOnce` (photo queue) both satisfy it, so the SAME trigger wiring
 * drains either queue.
 */
export type DrainFn<E> = (
  companyId: string,
  replay: (entry: E) => Promise<unknown>,
  opts: DrainCallbackOptions<E>,
) => Promise<DrainResult[]>;

export interface UseQueueProcessorOptions<E = unknown> {
  /** Tenant whose queue to drain. */
  companyId: string;
  /** Injected Server Action to replay each due entry against (DIP). */
  replay: (entry: E) => Promise<unknown>;
  /**
   * Sweep entry-point. Defaults to `drainOnce` (the mutation queue). The photo
   * processor passes `drainPhotosOnce`; a photo sweep and a mutation sweep
   * serialize on the shared single-flight guard in `processor.ts`.
   */
  drainFn?: DrainFn<E>;
  /** Maps replay errors to permanent (dead-letter immediately). */
  classifyError?: (err: unknown, entry: E) => boolean;
  /** Fired when an entry dead-letters. */
  onDead?: (entry: E) => void;
  /** Fired when an entry syncs successfully. */
  onSynced?: (entry: E) => void;
  /** Fired when an entry fails; `permanent` is true when dead-lettered. */
  onFailed?: (entry: E, permanent: boolean) => void;
  /** Periodic sweep interval in ms. Default 5000. */
  sweepIntervalMs?: number;
  /**
   * When `false`, the processor is dormant: no sweep triggers run and `drain`
   * is a no-op. The visit form disables it on completed/other-tech pages where
   * replaying queued drafts would dead-letter uselessly. Default `true`.
   */
  enabled?: boolean;
}

export interface UseQueueProcessorResult {
  /** Runs an immediate sweep; resolves with the per-entry outcomes. */
  drain: () => Promise<DrainResult[]>;
  /**
   * Whether a sweep is currently in flight (tenant-wide — a sweep drains the
   * whole tenant queue, not just one visit). Drives the "syncing" badge state.
   */
  inFlight: boolean;
}

/**
 * Wires the queue processor's triggers: drains when connectivity returns after
 * hydration, when the tab/WebView regains visibility (covers Capacitor resume
 * and PWA tab return), and on a periodic sweep so entries whose backoff window
 * just elapsed are retried. Gated on `useOnlineStatus` — an offline spell never
 * triggers a sweep, so retry budget is never consumed offline.
 *
 * Returns `{ drain, inFlight }`: `drain` for callers to trigger an immediate
 * sweep (e.g. after `retryDead`); `inFlight` reflects whether any sweep is
 * currently running (all triggers flow through `drain`). The single-flight
 * guard in `drainOnce` prevents overlapping sweeps from the various triggers.
 */
export function useQueueProcessor<E = unknown>(
  options: UseQueueProcessorOptions<E>,
): UseQueueProcessorResult {
  const { online, hydrated } = useOnlineStatus();
  const enabled = options.enabled !== false;

  // Latest-value refs so the interval/visibility listeners (registered once)
  // always observe the current options and connectivity. Ref writes happen in
  // effects (not during render) to satisfy react-hooks/refs.
  const optsRef = useRef(options);
  const onlineRef = useRef(online);
  const hydratedRef = useRef(hydrated);
  const enabledRef = useRef(enabled);

  // Track outstanding sweep calls so `inFlight` stays true while any drain is
  // running — concurrent triggers (interval + visibility) would otherwise
  // flicker the flag as the skipped sweep resolves before the real one.
  const [inFlight, setInFlight] = useState(false);
  const sweepCountRef = useRef(0);

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

  const drain = useCallback(async (): Promise<DrainResult[]> => {
    if (!enabledRef.current) return [];
    if (!onlineRef.current || !hydratedRef.current) return [];
    const {
      companyId,
      replay,
      drainFn,
      classifyError,
      onDead,
      onSynced,
      onFailed,
    } = optsRef.current;
    // The default only ever runs when the caller didn't inject a drainFn (the
    // mutation queue, where `E` is `QueuedMutation`) — the cast is safe.
    const sweep = (drainFn ?? drainOnce) as DrainFn<E>;
    sweepCountRef.current += 1;
    setInFlight(true);
    try {
      return await sweep(companyId, replay, {
        classifyError,
        onDead,
        onSynced,
        onFailed,
      });
    } catch (e) {
      console.error("Queue drain failed:", e);
      return [];
    } finally {
      sweepCountRef.current -= 1;
      if (sweepCountRef.current === 0) setInFlight(false);
    }
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

  return { drain, inFlight };
}
