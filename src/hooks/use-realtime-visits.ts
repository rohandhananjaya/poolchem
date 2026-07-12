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
  unreadCount: number
  markAllRead: () => void
}

export const NotificationContext = React.createContext<NotificationContextValue>({
  unreadCount: 0,
  markAllRead: () => {},
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
      // For UPDATE events, only notify when techId actually changed to this user
      if (payload.eventType === "UPDATE") {
        const oldTechId = (payload.old as VisitRow | null)?.techId ?? null
        const newTechId = (payload.new as VisitRow).techId
        if (oldTechId === newTechId) return
      }

      const visit = payload.new as VisitRow

      const { data: pool } = await supabase
        .from("pools")
        .select("name, address")
        .eq("id", visit.poolId)
        .single()

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

    const channel = supabase
      .channel("visits")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_visits",
          filter: `techId=eq.${techId}`,
        },
        handlePayload,
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
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

  const unreadCount = React.useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  )

  return { newVisitAlert, notifications, unreadCount, dismissAlert, markAllRead } as const
}
