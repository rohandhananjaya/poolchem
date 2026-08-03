/**
 * Shared app configuration, driven by environment variables with sensible
 * defaults. Import from here rather than reaching for `process.env` directly.
 */

/** Number of items per page across all list views. */
export const PAGE_SIZE = Number(process.env.PAGE_SIZE) || 10

/** Public privacy-policy URL. Set NEXT_PUBLIC_PRIVACY_URL to point to a hosted policy page. */
export const PRIVACY_URL = process.env.NEXT_PUBLIC_PRIVACY_URL ?? "/privacy"

/** Public terms-of-service URL. Set NEXT_PUBLIC_TERMS_URL to point to a hosted terms page. */
export const TERMS_URL = process.env.NEXT_PUBLIC_TERMS_URL ?? "/terms"
