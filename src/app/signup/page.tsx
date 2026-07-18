import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { hasSuperAdmin } from "@/lib/db/users"
import { getAllPackages } from "@/lib/db/packages"
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

  const packages = await getAllPackages()

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-blue-200 via-sky-100 to-blue-300">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden max-md:hidden">
        <div className="absolute -top-40 -right-40 size-[30rem] rounded-full bg-blue-300/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-[30rem] rounded-full bg-cyan-300/60 blur-3xl" />
      </div>
      <SignupForm packages={packages} />
    </div>
  )
}
