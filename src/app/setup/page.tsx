import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { hasSuperAdmin } from "@/lib/db/users"
import { SetupForm } from "./setup-form"

export const metadata: Metadata = {
  title: "Platform Setup | Poolbench",
  robots: { index: false, follow: false },
}

export default async function SetupPage() {
  if (await hasSuperAdmin()) {
    redirect("/login")
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-200 to-brand-50">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden max-md:hidden">
        <div className="absolute -top-40 -right-40 size-[30rem] rounded-full bg-brand-200/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-[30rem] rounded-full bg-brand-50/60 blur-3xl" />
      </div>
      <SetupForm />
    </div>
  )
}
