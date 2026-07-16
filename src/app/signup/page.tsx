import type { Metadata } from "next"

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

export default function SignupPage() {
  return <SignupForm />
}
