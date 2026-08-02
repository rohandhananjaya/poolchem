/**
 * Pure helpers for pool scan codes.
 *
 * A pool's QR code stores a deep link — `{origin}/scan?code=<qrCode>` — so a
 * tech's phone can "open properly": scanning it with the OS camera launches the
 * app at /scan and the page resolves the code straight into a visit. The value
 * a scanner returns (raw `POOL-…` text, a full URL, or a typed pool id) is
 * normalised here before it ever reaches a DB lookup.
 */

/** Characters a valid raw code or pool id may contain. */
const SAFE_CODE = /^[A-Za-z0-9_-]{8,64}$/;
/** Codes minted by the app (see newQRCode in src/lib/db/pools.ts). */
const POOL_CODE = /^POOL-[A-Za-z0-9-]+$/i;

/**
 * Builds the deep link encoded into a pool's QR code. Reads the app origin from
 * `NEXT_PUBLIC_APP_URL` (falling back to the local dev origin, matching the
 * rest of the app).
 */
export function buildScanUrl(qrCode: string): string {
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000").replace(/\/+$/, "");
  return `${origin}/scan?code=${encodeURIComponent(qrCode)}`;
}

/**
 * Extracts a pool identifier from whatever a camera/manual entry produced.
 * Accepts a raw `POOL-…` code, a pool id, or a deep-link URL carrying a `code`
 * query param. Returns `null` for anything unrecognised, so junk input never
 * triggers a DB lookup.
 */
export function normalizeScanCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return normalizeCodeValue(codeFromUrl(trimmed));
  }
  return normalizeCodeValue(trimmed);
}

/** Pulls the `code` param out of a scan URL (http(s) or custom scheme). */
function codeFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const protocol = parsed.protocol;
  if (protocol !== "http:" && protocol !== "https:" && protocol !== "poolbench:") {
    return null;
  }
  return parsed.searchParams.get("code");
}

function normalizeCodeValue(code: string | null): string | null {
  if (!code) return null;
  const value = code.trim();
  if (!value) return null;
  if (POOL_CODE.test(value) || SAFE_CODE.test(value)) return value;
  return null;
}
