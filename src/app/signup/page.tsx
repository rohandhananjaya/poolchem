import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { hasSuperAdmin } from "@/lib/db/users"
import { SignupForm } from "./signup-form"

export const metadata: Metadata = {
  title: "Create Account | Poolbench",
  description:
    "Create your Poolbench account and set up your pool-service company in minutes. Start tracking visits, water tests, and reports.",
  openGraph: {
    title: "Create Account | Poolbench",
    description:
      "Create your Poolbench account and set up your pool-service company in minutes. Start tracking visits, water tests, and reports.",
    url: "/signup",
  },
  alternates: { canonical: "/signup" },
}

export default async function SignupPage() {
  if (!(await hasSuperAdmin())) {
    redirect("/setup")
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-200 to-brand-50">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden max-md:hidden">
        <div className="absolute -top-40 -right-40 size-[30rem] rounded-full bg-brand-200/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-[30rem] rounded-full bg-brand-50/60 blur-3xl" />
      </div>
      <SignupForm />
    </div>
  )
}
