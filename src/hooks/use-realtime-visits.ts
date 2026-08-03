"use client"

import * as React from "react"

import { createClient } from "@/lib/supabase/client"
import type { RealtimePostgresChangesPayload } from "@supabase/realtime-js"

export interface VisitNotification {
  id: string
  visitId: string
  poolName: string
  poolAddress: string | null
  assignedAt: Date
  read: boolean
}

export interface NewVisitAlert {
  visitId: string
  poolName: string
  poolAddress: string | null
  assignedAt: Date
}

interface VisitRow {
  id: string
  poolId: string
  techId: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Context for sharing notification state across the dashboard layout.
 */
export interface NotificationContextValue {
  notifications: VisitNotification[]
  unreadCount: number
  markAllRead: () => void
  markRead: (id: string) => void
}

export const NotificationContext = React.createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  markAllRead: () => {},
  markRead: () => {},
})

export function useRealtimeVisits(techId: string) {
  const [notifications, setNotifications] = React.useState<VisitNotification[]>([])
  const [newVisitAlert, setNewVisitAlert] = React.useState<NewVisitAlert | null>(null)

  React.useEffect(() => {
    if (!techId) return

    const supabase = createClient()

    async function handlePayload(
      payload: RealtimePostgresChangesPayload<VisitRow>,
    ) {
      const visit = payload.new as VisitRow

      // Filtered here (not via the subscription's `filter` option) because that
      // option builds a server-side string filter against the raw column name —
      // fragile against Postgres's case-preserved, quoted "techId" column.
      if (visit.techId !== techId) return

      // For UPDATE events, only notify when techId actually changed to this user
      if (payload.eventType === "UPDATE") {
        const oldTechId = (payload.old as VisitRow | null)?.techId ?? null
        if (oldTechId === visit.techId) return
      }

      const { data: pool, error } = await supabase
        .from("pools")
        .select("name, address")
        .eq("id", visit.poolId)
        .single()

      if (error) {
        console.error("useRealtimeVisits: failed to load pool for notification", error)
      }
      if (!pool) return

      setNotifications((prev) => {
        if (prev.some((n) => n.visitId === visit.id)) return prev
        return [
          {
            id: visit.id,
            visitId: visit.id,
            poolName: pool.name,
            poolAddress: pool.address,
            assignedAt: new Date(
              payload.eventType === "UPDATE" ? visit.updatedAt : visit.createdAt,
            ),
            read: false,
          },
          ...prev,
        ]
      })

      setNewVisitAlert({
        visitId: visit.id,
        poolName: pool.name,
        poolAddress: pool.address,
        assignedAt: new Date(
          payload.eventType === "UPDATE" ? visit.updatedAt : visit.createdAt,
        ),
      })
    }

    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    // RLS-gated postgres_changes checks are authorized using the token handed
    // to Realtime via setAuth() — being signed in isn't enough on its own, and
    // subscribing before this resolves silently evaluates RLS as unauthorized
    // (surfaced as "Error 401: Unauthorized" per-event, join itself still "ok").
    async function subscribe() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        supabase.realtime.setAuth(session.access_token)
      }
      if (cancelled) return

      channel = supabase
        .channel("visits")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "service_visits",
          },
          handlePayload,
        )
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error("useRealtimeVisits: subscription failed", status, err)
          }
        })
    }

    subscribe()

    // Keep Realtime's RLS-check token current across a long-lived tab.
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        supabase.realtime.setAuth(session.access_token)
      }
    })

    return () => {
      cancelled = true
      authListener.subscription.unsubscribe()
      if (channel) supabase.removeChannel(channel)
    }
  }, [techId])

  React.useEffect(() => {
    if (!newVisitAlert) return
    const timer = setTimeout(() => setNewVisitAlert(null), 5000)
    return () => clearTimeout(timer)
  }, [newVisitAlert])

  const dismissAlert = React.useCallback(() => {
    setNewVisitAlert(null)
  }, [])

  const markAllRead = React.useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const markRead = React.useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
  }, [])

  const unreadCount = React.useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  )

  return {
    newVisitAlert,
    notifications,
    unreadCount,
    dismissAlert,
    markAllRead,
    markRead,
  } as const
}
