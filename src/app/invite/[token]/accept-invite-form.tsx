"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { acceptInvitationAction, type AcceptFormState } from "./actions"

const INITIAL_STATE: AcceptFormState = { ok: false }

export function AcceptInviteForm({
  token,
  name,
  email,
}: {
  token: string
  name: string
  email: string
}) {
  const router = useRouter()
  const [state, action, pending] = React.useActionState(acceptInvitationAction, INITIAL_STATE)
  const [signingIn, setSigningIn] = React.useState(false)

  React.useEffect(() => {
    if (!state.ok) return

    setSigningIn(true)

    const form = document.querySelector<HTMLFormElement>("form")
    if (!form) return
    const formData = new FormData(form)
    const password = formData.get("password") as string

    const supabase = createClient()
    supabase.auth.signInWithPassword({ email, password }).then(({ error }) => {
      if (error) {
        setSigningIn(false)
        return
      }
      router.push("/dashboard")
      router.refresh()
    })
  }, [state.ok, email, router])

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" value={name} readOnly className="bg-muted" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} readOnly className="bg-muted" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={6}
        />
        <p className="text-xs text-muted-foreground">
          At least 6 characters.
        </p>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending || signingIn}>
        {pending
          ? "Creating account…"
          : signingIn
            ? "Signing you in…"
            : "Accept invitation"}
      </Button>
    </form>
  )
}
