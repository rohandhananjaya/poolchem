"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"

/**
 * Mounted on server-rendered visit-list pages (dashboard, schedule) so an
 * add/cancel/reschedule/reassign from another session shows up without a
 * manual reload. Renders nothing — just re-runs the server fetch on change.
 */
export function RealtimeVisitsRefresh() {
  const router = useRouter()

  React.useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    // Coalesce bursts (e.g. a bulk reschedule) into a single refetch.
    function scheduleRefresh() {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => router.refresh(), 500)
    }

    // See use-realtime-visits.ts for why setAuth() must resolve before subscribing.
    async function subscribe() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        supabase.realtime.setAuth(session.access_token)
      }
      if (cancelled) return

      channel = supabase
        .channel("visits-list-refresh")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "service_visits" },
          scheduleRefresh,
        )
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            // Transient transport failure (network flake, brief offline, dev
            // proxy hiccups) — realtime-js reconnects the socket and rejoins
            // the channel. Log as a warning (skip when already offline) rather
            // than an error for an expected, handled condition.
            if (typeof navigator === "undefined" || navigator.onLine) {
              console.warn(
                "RealtimeVisitsRefresh: subscription failed, waiting for reconnect",
                status,
                err,
              )
            }
          }
        })
    }

    subscribe()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        supabase.realtime.setAuth(session.access_token)
      }
    })

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      authListener.subscription.unsubscribe()
      if (channel) supabase.removeChannel(channel)
    }
  }, [router])

  return null
}
