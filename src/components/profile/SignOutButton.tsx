"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export function SignOutButton() {
  const router = useRouter()
  const [signingOut, setSigningOut] = React.useState(false)

  async function handleSignOut() {
    setSigningOut(true)
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
