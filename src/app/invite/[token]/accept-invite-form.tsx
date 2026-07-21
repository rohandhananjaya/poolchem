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
  const [pending, startTransition] = React.useTransition()
  const [state, setState] = React.useState(INITIAL_STATE)
  const [signingIn, setSigningIn] = React.useState(false)

  function action(formData: FormData) {
    startTransition(async () => {
      const result = await acceptInvitationAction(INITIAL_STATE, formData)
      setState(result)
      if (!result.ok) return

      setSigningIn(true)
      const password = formData.get("password") as string
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setSigningIn(false)
        return
      }
      router.push("/dashboard")
      router.refresh()
    })
  }

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
