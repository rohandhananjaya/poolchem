import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { hasSuperAdmin } from "@/lib/db/users"
import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Sign In | Poolbench",
  description:
    "Sign in to your Poolbench account to manage your pool-service company, track visits, and generate water-health reports.",
  openGraph: {
    title: "Sign In | Poolbench",
    description:
      "Sign in to your Poolbench account to manage your pool-service company, track visits, and generate water-health reports.",
    url: "/login",
  },
  alternates: { canonical: "/login" },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ signup?: string; setup?: string }>
}) {
  const { signup, setup } = await searchParams

  if (!(await hasSuperAdmin())) {
    redirect("/setup")
  }

  const successMessage =
    setup === "success"
      ? "Admin account created! Sign in with your credentials to finish setup."
      : signup === "success"
        ? "Account created successfully! Sign in with your credentials."
        : undefined

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-200 to-brand-50">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden max-md:hidden">
        <div className="absolute -top-40 -right-40 size-[30rem] rounded-full bg-brand-200/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-[30rem] rounded-full bg-brand-50/60 blur-3xl" />
      </div>
      <LoginForm successMessage={successMessage} />
    </div>
  )
}
