/**
 * Builds a query string from search params, overriding specific keys.
 * Used for pagination / filter links across list pages.
 */
export function buildQueryString(
  params: URLSearchParams,
  overrides: Record<string, string | undefined>,
): string {
  const next = new URLSearchParams(params)
  for (const [key, value] of Object.entries(overrides)) {
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
  }
  return next.toString()
}

/** Collapses a long page range with ellipses: [1, "...", 5, 6, 7, "...", 20]. */
export function generatePageNumbers(
  current: number,
  total: number,
): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | "...")[] = []
  const siblings = 1

  const rangeStart = Math.max(2, current - siblings)
  const rangeEnd = Math.min(total - 1, current + siblings)

  pages.push(1)

  if (rangeStart > 2) {
    pages.push("...")
  }

  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i)
  }

  if (rangeEnd < total - 1) {
    pages.push("...")
  }

  pages.push(total)

  return pages
}
