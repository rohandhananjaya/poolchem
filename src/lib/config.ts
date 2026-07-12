/**
 * Shared app configuration, driven by environment variables with sensible
 * defaults. Import from here rather than reaching for `process.env` directly.
 */

/** Number of items per page across all list views. */
export const PAGE_SIZE = Number(process.env.PAGE_SIZE) || 10
