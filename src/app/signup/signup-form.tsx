"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { signupAction, type SignupFormState } from "./actions"
import type { PackageInfo } from "@/lib/package-features"
import { formatPrice } from "@/lib/package-features"

const INITIAL_STATE: SignupFormState = { ok: false }

export function SignupForm({ packages }: { packages: PackageInfo[] }) {
  const router = useRouter()
  const [state, action, pending] = React.useActionState(signupAction, INITIAL_STATE)
  const [selected, setSelected] = React.useState("starter")

  React.useEffect(() => {
    if (!state.ok) return
    router.push("/login?signup=success")
  }, [state.ok, router])

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

          <div className="space-y-2">
            <Label>Choose your plan</Label>
            <div className="space-y-2">
              {packages.map((pkg) => (
                <label
                  key={pkg.slug}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                    selected === pkg.slug
                      ? "border-teal-500 bg-teal-50 dark:bg-teal-950/20"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="package"
                    value={pkg.slug}
                    checked={selected === pkg.slug}
                    onChange={() => setSelected(pkg.slug)}
                    className="size-4 accent-teal-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {pkg.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pkg.price === 0 ? "Free" : formatPrice(pkg.price) + "/mo"}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={pending}
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