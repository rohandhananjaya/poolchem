"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Capacitor } from "@capacitor/core"
import { LogOut } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { unregisterPushDeviceAction } from "@/app/(dashboard)/push/actions"
import { PUSH_TOKEN_KEY } from "@/components/notifications/PushRegistration"
import { Button } from "@/components/ui/button"

export function SignOutButton() {
  const router = useRouter()
  const [signingOut, setSigningOut] = React.useState(false)

  async function handleSignOut() {
    setSigningOut(true)

    // In the native app, drop the device's push token before closing the
    // session so it stops receiving notifications after sign-out.
    if (Capacitor.isNativePlatform()) {
      const token = localStorage.getItem(PUSH_TOKEN_KEY)
      if (token) {
        await unregisterPushDeviceAction(token).catch(() => {})
        localStorage.removeItem(PUSH_TOKEN_KEY)
      }
    }

    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      disabled={signingOut}
      onClick={handleSignOut}
    >
      <LogOut />
      {signingOut ? "Signing out…" : "Sign out"}
    </Button>
  )
}
