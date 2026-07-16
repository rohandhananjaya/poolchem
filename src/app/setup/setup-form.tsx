"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { setupAction, type SetupFormState } from "./actions"

const INITIAL_STATE: SetupFormState = { ok: false }

export function SetupForm() {
  const router = useRouter()
  const [state, action, pending] = React.useActionState(setupAction, INITIAL_STATE)

  React.useEffect(() => {
    if (!state.ok) return
    router.push("/login?setup=success")
  }, [state.ok, router])

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 md:p-8 shadow-sm">
        <div className="space-y-1.5 text-center">
          <div className="mb-4 inline-flex items-center justify-center">
            <Image
              src="/images/POOLBENCH.png"
              alt="Poolbench"
              width={140}
              height={40}
              className="h-auto w-auto"
              priority
            />
          </div>
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Set up platform admin
          </h1>
          <p className="text-sm text-muted-foreground">
            No platform admin exists yet. Create the first super admin account
            to finish setting up Poolbench.
          </p>
        </div>

        {state.error && (
          <div
            role="alert"
            className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </div>
        )}

        <form action={action} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. Jane Smith"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
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

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={pending}
          >
            {pending ? "Creating…" : "Create admin account"}
          </Button>
        </form>
      </div>
    </div>
  )
}
