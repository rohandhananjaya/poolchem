"use client"

import * as React from "react"

import { Capacitor } from "@capacitor/core"
import { PushNotifications } from "@capacitor/push-notifications"

import {
  registerPushDeviceAction,
} from "@/app/(dashboard)/push/actions"
import type { PushPlatform } from "@/generated/prisma/client"

/** localStorage key for the current device token (read on sign-out). */
export const PUSH_TOKEN_KEY = "poolbench:pushToken"

/**
 * Registers the native device for push notifications and handles notification
 * taps. Mounted once in the dashboard shell.
 *
 * Only runs inside the Capacitor native app — the browser/PWA path continues
 * to use in-app realtime notifications (`useRealtimeVisits`), so this renders
 * nothing and does nothing on the web.
 */
export function PushRegistration() {
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let active = true

    async function init() {
      const platform = (
        Capacitor.getPlatform() === "ios" ? "IOS" : "ANDROID"
      ) as PushPlatform

      // Listeners must be registered before `register()` so a cold start from
      // a notification tap is captured.
      PushNotifications.addListener(
        "registration",
        ({ value }) => {
          if (!active) return
          try {
            localStorage.setItem(PUSH_TOKEN_KEY, value)
          } catch {
            // Storage unavailable — registration still proceeds.
          }
          registerPushDeviceAction({ token: value, platform }).catch(() => {
            // Registration failures are non-fatal; the app still works without
            // push. Retried on next launch.
          })
        },
      )

      PushNotifications.addListener("registrationError", (err) => {
        console.error("Push registration failed:", err)
      })

      PushNotifications.addListener(
        "pushNotificationActionPerformed",
        ({ notification }) => {
          const visitId = notification.data?.visitId
          if (typeof visitId === "string" && visitId.length > 0) {
            window.location.href = `/visits/${visitId}`
          }
        },
      )

      PushNotifications.addListener("pushNotificationReceived", () => {
        // Foreground: the in-app realtime toast (`NotificationProvider`) already
        // surfaces new-visit alerts, so nothing else to show here.
      })

      const permission = await PushNotifications.checkPermissions()
      if (
        permission.receive === "prompt" ||
        permission.receive === "prompt-with-rationale"
      ) {
        await PushNotifications.requestPermissions()
      }
      await PushNotifications.register()
    }

    init()

    return () => {
      active = false
      PushNotifications.removeAllListeners()
    }
  }, [])

  return null
}
