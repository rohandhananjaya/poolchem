"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { TurnstileWidget, isTurnstileEnabled } from "@/components/ui/turnstile-widget"
import { signupAction, type SignupFormState } from "./actions"

const INITIAL_STATE: SignupFormState = { ok: false }

export function SignupForm() {
  const [state, action, pending] = React.useActionState(signupAction, INITIAL_STATE)
  const [turnstileToken, setTurnstileToken] = React.useState("")
  const [submittedEmail, setSubmittedEmail] = React.useState("")

  if (state.ok) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 md:p-8 shadow-sm text-center">
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
            Check your email
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {submittedEmail
              ? `We sent a confirmation link to ${submittedEmail}. Click it to activate your account.`
              : "We sent you a confirmation link. Click it to activate your account."}
          </p>
          <Button asChild size="lg" className="mt-6 w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      </div>
    )
  }

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
            Create your company
          </h1>
          <p className="text-sm text-muted-foreground">
            Set up your pool-service company in minutes.
          </p>
        </div>

        {state.error && (
          <div
            role="alert"
            className="mt-6 rounded-lg border px-3 py-2 text-sm"
          >
            {state.error}
          </div>
        )}

        <form action={action} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              name="companyName"
              placeholder="e.g. ClearBlue Pool Service"
              required
            />
          </div>

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
              onChange={(e) => setSubmittedEmail(e.target.value)}
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

          <TurnstileWidget
            onVerify={setTurnstileToken}
            onExpire={() => setTurnstileToken("")}
            className="flex justify-center"
          />

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={pending || (isTurnstileEnabled() && !turnstileToken)}
          >
            {pending ? "Creating…" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          Already have an account?{" "}
          <Link
            href="/login"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}