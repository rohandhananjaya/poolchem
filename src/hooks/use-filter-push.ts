"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback } from "react"

/**
 * Returns a push function that updates search params, resets page to 1, and
 * navigates. Skips the `page` key from the current params so that changing a
 * filter always goes back to the first page.
 */
export function useFilterPush() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams()
      for (const [key, value] of searchParams.entries()) {
        if (key !== "page") params.set(key, value)
      }
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value)
        else params.delete(key)
      }
      params.set("page", "1")
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )
}
