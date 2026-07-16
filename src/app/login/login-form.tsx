"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { loginAction, type LoginFormState } from "./actions"

const INITIAL_STATE: LoginFormState = { ok: false }

export function LoginForm({ showSuccess }: { showSuccess: boolean }) {
  const router = useRouter()
  const [state, action, pending] = React.useActionState(loginAction, INITIAL_STATE)
  const [oauthError, setOauthError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!state.ok) return
    router.replace("/dashboard")
  }, [state.ok, router])

  const error = state.error ?? oauthError

  async function handleGoogleSignIn() {
    setOauthError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setOauthError(error.message)
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 md:p-8 shadow-sm">
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Sign in
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and password to access your account.
          </p>
        </div>

        {showSuccess && (
          <div
            role="status"
            className="mt-6 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
          >
            Account created successfully! Sign in with your credentials.
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <form action={action} className="mt-6 space-y-4">
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
              autoComplete="current-password"
              required
            />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Don&apos;t have an account?{" "}
            <a
              href="/signup"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Create one
            </a>
          </p>
        </form>

        <div className="mt-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="mt-6 w-full"
          disabled={pending}
          onClick={handleGoogleSignIn}
        >
          Continue with Google
        </Button>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          By signing in with Google, you share your email address and basic
          profile info with Poolbench.{" "}
          <a
            href="/privacy"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Privacy notice
          </a>
          .
        </p>
      </div>
    </div>
  )
}
