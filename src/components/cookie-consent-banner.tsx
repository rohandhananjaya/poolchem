"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"

const STORAGE_KEY = "poolbench-cookie-consent"
const CONSENT_CHANGE_EVENT = "poolbench-cookie-consent-change"

function getConsent(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "accepted"
}

function subscribe(callback: () => void) {
  window.addEventListener(CONSENT_CHANGE_EVENT, callback)
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, callback)
}

// Hidden on the server and on the client's first paint (no localStorage
// access yet) so hydration always matches; useSyncExternalStore re-reads
// the real value right after mount without a setState-in-effect render.
function getServerSnapshot() {
  return true
}

export function CookieConsentBanner() {
  const accepted = React.useSyncExternalStore(
    subscribe,
    getConsent,
    getServerSnapshot,
  )
  const visible = !accepted

  function accept() {
    localStorage.setItem(STORAGE_KEY, "accepted")
    window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT))
  }

  if (!visible) return null

  return (
    <>
      {/* Reserves scroll room so the fixed banner below never overlaps the
          last real content on a page (e.g. the visit form's Complete
          button) — heights approximate the banner's own responsive layout,
          which stacks text+button vertically below `sm` and inline above it. */}
      <div aria-hidden className="h-28 sm:h-14 print:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card p-4 print:hidden">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Poolbench uses essential cookies for authentication.{" "}
            <a
              href="https://poolbench.com/privacy"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Learn more
            </a>
            .
          </p>
          <Button onClick={accept} size="sm">
            Got it
          </Button>
        </div>
      </div>
    </>
  )
}
