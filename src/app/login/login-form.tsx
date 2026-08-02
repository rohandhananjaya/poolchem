"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { loginAction, requestPasswordResetAction, type LoginFormState } from "./actions"

const INITIAL_STATE: LoginFormState = { ok: false }

export function LoginForm({
  successMessage,
  code,
}: {
  successMessage?: string
  code?: string
}) {
  const [state, action, pending] = React.useActionState(loginAction, INITIAL_STATE)
  const [resetState, resetAction, resetPending] = React.useActionState(
    requestPasswordResetAction,
    INITIAL_STATE,
  )
  const [showReset, setShowReset] = React.useState(false)

  const error = state.error

  const resetView = showReset || resetState.sent ? (
    <form action={resetAction} className="mt-6 space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter your account email and we&apos;ll send you a link to reset your password.
      </p>
      <div className="space-y-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input
          id="reset-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </div>

      {resetState.sent && (
        <div
          role="status"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          If that account exists, a password reset link is on its way.
        </div>
      )}
      {resetState.error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {resetState.error}
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={resetPending}>
        {resetPending ? "Sending…" : "Send reset link"}
      </Button>
      <button
        type="button"
        onClick={() => setShowReset(false)}
        className="w-full text-center text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
      >
        Back to sign in
      </button>
    </form>
  ) : (
    <form action={action} className="mt-6 space-y-4">
      {/* Carry a scanned-QR deep link through login so the user lands back
          on /scan?code=… and the visit starts automatically. */}
      {code ? <input type="hidden" name="code" value={code} /> : null}
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
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <button
            type="button"
            onClick={() => setShowReset(true)}
            className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          >
            Forgot password?
          </button>
        </div>
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
  )

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 md:p-8 shadow-sm">
        <div className="space-y-1.5 text-center">
          <Link href="/" className="inline-flex items-center justify-center mb-4">
            <Image
              src="/images/POOLBENCH.png"
              alt="Poolbench"
              width={140}
              height={40}
              className="h-auto w-auto"
              priority
            />
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {showReset || resetState.sent ? "Reset password" : "Sign in"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {showReset || resetState.sent
              ? "We'll email you a link to set a new password."
              : "Enter your email and password to access your account."}
          </p>
        </div>

        {successMessage && (
          <div
            role="status"
            className="mt-6 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
          >
            {successMessage}
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

        {resetView}
      </div>
    </div>
  )
}
