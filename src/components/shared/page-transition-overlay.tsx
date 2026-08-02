"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const SHOW_DELAY_MS = 120
const SAFETY_TIMEOUT_MS = 10_000

interface PendingNavigation {
  startPath: string
}

export function PageTransitionOverlay() {
  const pathname = usePathname()
  const [visible, setVisible] = React.useState(false)

  const pathnameRef = React.useRef(pathname)
  const pendingRef = React.useRef<PendingNavigation | null>(null)
  const showTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const safetyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = React.useCallback(() => {
    if (showTimerRef.current !== null) {
      clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }
    if (safetyTimerRef.current !== null) {
      clearTimeout(safetyTimerRef.current)
      safetyTimerRef.current = null
    }
  }, [])

  const finish = React.useCallback(() => {
    pendingRef.current = null
    clearTimers()
    setVisible(false)
  }, [clearTimers])

  React.useEffect(() => {
    pathnameRef.current = pathname
    if (
      pendingRef.current !== null &&
      pathname !== pendingRef.current.startPath
    ) {
      finish()
    }
  }, [pathname, finish])

  React.useEffect(() => {
    function isModifiedClick(event: MouseEvent): boolean {
      return (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      )
    }

    function isInternalHref(href: string): boolean {
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:")
      ) {
        return false
      }
      if (href.startsWith("/")) return true
      try {
        return new URL(href, window.location.href).origin === window.location.origin
      } catch {
        return false
      }
    }

    function handleClick(event: MouseEvent) {
      if (isModifiedClick(event)) return
      if (event.defaultPrevented) return

      const target = event.target as Element | null
      const anchor = target?.closest?.("a[href]")
      if (!anchor) return

      const href = anchor.getAttribute("href")
      if (!href || !isInternalHref(href)) return
      if (anchor.hasAttribute("download") || anchor.getAttribute("target") === "_blank") {
        return
      }

      let url: URL
      try {
        url = new URL(href, window.location.href)
      } catch {
        return
      }
      if (url.pathname === pathnameRef.current) return

      pendingRef.current = { startPath: pathnameRef.current }

      showTimerRef.current = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
      safetyTimerRef.current = setTimeout(finish, SAFETY_TIMEOUT_MS)
    }

    function handlePopState() {
      finish()
    }

    document.addEventListener("click", handleClick, true)
    window.addEventListener("popstate", handlePopState)

    return () => {
      document.removeEventListener("click", handleClick, true)
      window.removeEventListener("popstate", handlePopState)
      clearTimers()
    }
  }, [finish, clearTimers])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm transition-opacity duration-200",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div className="rounded-full bg-card p-4 shadow-sm">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  )
}
