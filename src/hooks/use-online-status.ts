"use client"

import { useSyncExternalStore } from "react"

function subscribe(callback: () => void) {
  window.addEventListener("online", callback)
  window.addEventListener("offline", callback)
  return () => {
    window.removeEventListener("online", callback)
    window.removeEventListener("offline", callback)
  }
}

function getSnapshot() {
  return typeof navigator === "undefined" || navigator.onLine
}

// Optimistic `true` on the server and the client's first paint so hydration
// always matches (same rationale as CookieConsentBanner); useSyncExternalStore
// re-reads the real value right after mount.
function getServerSnapshot() {
  return true
}

// Hydration marker: `false` on the server and the client's first paint, `true`
// once useSyncExternalStore re-reads the real snapshot after mount. Uses the
// same trick as `online` above, so no setState-in-effect is needed to know when
// the optimistic snapshot has been superseded.
function getHydratedSnapshot() {
  return true
}

function getHydratedServerSnapshot() {
  return false
}

export interface OnlineStatus {
  /** Whether the device is online (the real value once `hydrated`). */
  online: boolean
  /**
   * Whether the optimistic first-paint snapshot has been superseded by the
   * real `navigator.onLine` read. `online` is not trustworthy until this is
   * true — a flush triggered on mount while `hydrated` is false would fire
   * against the optimistic `true` even when the device is offline.
   */
  hydrated: boolean
}

export function useOnlineStatus(): OnlineStatus {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const hydrated = useSyncExternalStore(
    () => () => {},
    getHydratedSnapshot,
    getHydratedServerSnapshot,
  )
  return { online, hydrated }
}
