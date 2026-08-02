"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { createClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const supabase = React.useState(() => createClient())[0];
  const [loading, setLoading] = React.useState(true);
  const [hasSession, setHasSession] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    // Recovery links arrive at /auth/update-password#access_token=… — the
    // browser client detects the session from the URL hash on init.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setLoading(false);
    });
    return () => subscription.subscription.unsubscribe();
  }, [supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      return;
    }
    await supabase.auth.signOut();
    setDone(true);
    window.location.href = "/login?reset=success";
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-200 to-brand-50">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden max-md:hidden">
        <div className="absolute -top-40 -right-40 size-[30rem] rounded-full bg-brand-200/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-[30rem] rounded-full bg-brand-50/60 blur-3xl" />
      </div>

      <div className="flex w-full max-w-sm flex-1 items-center justify-center px-4 py-16">
        <div className="w-full rounded-xl border border-border bg-card p-6 md:p-8 shadow-sm">
          <div className="space-y-1.5 text-center">
            <Link href="/" className="mb-4 inline-flex items-center justify-center">
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
              Set a new password
            </h1>
            <p className="text-sm text-muted-foreground">
              Choose a new password for your account.
            </p>
          </div>

          {loading ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Checking your link…
            </p>
          ) : !hasSession ? (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-destructive">
                This password reset link is invalid or has expired.
              </p>
              <Button asChild size="lg" className="w-full">
                <Link href="/login">Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <PasswordInput
                  id="confirm"
                  name="confirm"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </div>
              )}
              {done && (
                <div
                  role="status"
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                >
                  Password updated — signing you out.
                </div>
              )}

              <Button type="submit" size="lg" className="w-full">
                Update password
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
