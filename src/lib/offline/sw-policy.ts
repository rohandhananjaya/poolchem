/**
 * Pure service-worker policy for the offline visit flow — no worker globals.
 *
 * Owns two concerns so `src/app/sw.ts` stays a thin Serwist wiring point:
 *   1. A NetworkOnly guard for same-origin non-GET requests (Server Actions),
 *      so a failed action POST surfaces its error to the mutation queue instead
 *      of ever being served a stale cached response.
 *   2. The stable public/ precache list the auto-injected `__SW_MANIFEST`
 *      misses, plus composition (merge + dedupe) for `precacheEntries`.
 *
 * No I/O: this module only describes rules/entries; `sw.ts` supplies
 * `defaultCache` (DIP) so tests can inject fakes without a worker runtime.
 */

import { NetworkOnly } from "serwist";
import type {
  PrecacheEntry,
  RouteMatchCallbackOptions,
  RuntimeCaching,
} from "serwist";

/** The minimal request shape the matcher reads (a `Request` satisfies it). */
export interface ServerActionRequestLike {
  method?: string;
}

/** Match context the router supplies (a subset of `RouteMatchCallbackOptions`). */
export interface ServerActionContext {
  sameOrigin: boolean;
}

/**
 * True for any same-origin non-GET request — i.e. a Server Action POST (visit
 * save/complete, logo upload) or future same-origin form/action. Method-based
 * rather than `Next-Action`-header-specific so any future non-GET action is
 * covered; OPTIONS/HEAD forced network-only is correct anyway.
 */
export function isServerActionRequest(
  request: ServerActionRequestLike,
  context: ServerActionContext,
): boolean {
  return context.sameOrigin && (request.method ?? "GET") !== "GET";
}

/**
 * Serwist routes are keyed by HTTP method, so a rule with no `method` only
 * ever sees GET requests. Cover every non-GET method the app could issue a
 * same-origin action with; OPTIONS is excluded because serwist's `validMethods`
 * rejects it at construction.
 */
export const SERVER_ACTION_METHODS = [
  "DELETE",
  "HEAD",
  "PATCH",
  "POST",
  "PUT",
] as const;

/** One NetworkOnly rule per non-GET method, placed first so it wins. */
export function buildServerActionRules(): RuntimeCaching[] {
  return SERVER_ACTION_METHODS.map((method) => ({
    method,
    matcher: (options: RouteMatchCallbackOptions) =>
      isServerActionRequest(
        { method: options.request?.method },
        { sameOrigin: options.sameOrigin },
      ),
    handler: new NetworkOnly(),
  }));
}

/**
 * Runtime caching with the Server Action guard prepended. `baseRules` is the
 * injected `defaultCache` from `@serwist/turbopack/worker` (kept out of this
 * module so it stays importable in tests without a worker env).
 */
export function buildRuntimeCaching(baseRules: RuntimeCaching[] = []): RuntimeCaching[] {
  return [...buildServerActionRules(), ...baseRules];
}

/**
 * Stable non-hashed assets the auto-injected manifest misses. The JS/CSS
 * bundle is already covered by `__SW_MANIFEST`; these fill the public-asset
 * gap. `revision: null` so serwist fetches-and-fingers them at install rather
 * than computing an integrity hash.
 */
export const APP_SHELL_PRECACHE: PrecacheEntry[] = [
  { url: "/manifest.webmanifest", revision: null },
  { url: "/icons/icon-192.png", revision: null },
  { url: "/icons/icon-512.png", revision: null },
  { url: "/icons/apple-touch-icon.png", revision: null },
];

/**
 * Merges the build-injected manifest with the shell entries, normalizing
 * string entries to `{ url }`, deduping by URL (first occurrence wins — the
 * hashed manifest entry beats a shell entry on collision), and dropping
 * anything without a usable URL. Tolerates an absent dev manifest.
 */
export function composePrecacheEntries(
  manifest: (PrecacheEntry | string)[] | undefined,
  shell: PrecacheEntry[] = APP_SHELL_PRECACHE,
): PrecacheEntry[] {
  const seen = new Set<string>();
  const composed: PrecacheEntry[] = [];
  for (const entry of [...(manifest ?? []), ...shell]) {
    const normalized: PrecacheEntry =
      typeof entry === "string" ? { url: entry } : entry;
    if (!normalized?.url || seen.has(normalized.url)) continue;
    seen.add(normalized.url);
    composed.push(normalized);
  }
  return composed;
}
