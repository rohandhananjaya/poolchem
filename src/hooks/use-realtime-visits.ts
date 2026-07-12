"use client"

import * as React from "react"

import { createClient } from "@/lib/supabase/client"

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

export function useRealtimeVisits(techId: string) {
  const [notifications, setNotifications] = React.useState<VisitNotification[]>([])
  const [newVisitAlert, setNewVisitAlert] = React.useState<NewVisitAlert | null>(null)

  React.useEffect(() => {
    if (!techId) return

    const supabase = createClient()

    const channel = supabase
      .channel("visits")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "service_visits",
          filter: `techId=eq.${techId}`,
        },
        async (payload) => {
          const visit = payload.new as { id: string; poolId: string; createdAt: string }

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
                assignedAt: new Date(visit.createdAt),
                read: false,
              },
              ...prev,
            ]
          })

          setNewVisitAlert({
            visitId: visit.id,
            poolName: pool.name,
            poolAddress: pool.address,
            assignedAt: new Date(visit.createdAt),
          })
        },
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
