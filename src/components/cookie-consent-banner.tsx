"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"

const STORAGE_KEY = "poolbench-cookie-consent"

function getConsent(): boolean {
  if (typeof window === "undefined") return true
  return localStorage.getItem(STORAGE_KEY) === "accepted"
}

export function CookieConsentBanner() {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    setVisible(!getConsent())
  }, [])

  function accept() {
    localStorage.setItem(STORAGE_KEY, "accepted")
    setVisible(false)
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
