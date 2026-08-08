/**
 * Pure backoff scheduling for the offline mutation queue.
 *
 * No I/O — this module only computes delays; the queue processor persists the
 * resulting `nextRetryAt` in IndexedDB so a reload resumes the schedule instead
 * of restarting it. Tunable via `BackoffOptions` (kept out of a god-object per
 * ISP — each consumer passes the subset it cares about).
 */

/** Max times a transient failure is retried before the entry is dead-lettered. */
export const MAX_RETRIES = 6;

export interface BackoffOptions {
  /** Delay before the first retry, ms. Default 2000 (2s). */
  base?: number;
  /** Exponential multiplier applied each retry. Default 2 (doubling). */
  multiplier?: number;
  /** Hard ceiling on the delay, ms. Default 300000 (5 min). */
  cap?: number;
  /** ±fraction jitter applied to the delay. Default 0.2 (±20%). */
  jitter?: number;
}

/**
 * Computes the delay (ms) before the retry whose 0-based `attempt` index is
 * given. Attempt 0 yields `base`; each further attempt multiplies by
 * `multiplier`, capped at `cap`, then jittered by ±`jitter` and rounded.
 */
export function nextDelayMs(attempt: number, opts: BackoffOptions = {}): number {
  const { base = 2000, multiplier = 2, cap = 300000, jitter = 0.2 } = opts;
  const safeAttempt = Math.max(0, Math.floor(attempt));
  const exponential = base * Math.pow(multiplier, safeAttempt);
  const clamped = Math.min(exponential, cap);
  const jittered = clamped * (1 - jitter + Math.random() * jitter * 2);
  return Math.round(jittered);
}

/**
 * Absolute epoch-ms at which the retry for `attempt` becomes due. Persisted by
 * the processor as `QueuedMutation.nextRetryAt` so the schedule survives a
 * reload.
 */
export function computeNextRetryAt(
  now: number,
  attempt: number,
  opts: BackoffOptions = {},
): number {
  return now + nextDelayMs(attempt, opts);
}
