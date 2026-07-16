import type { Metadata } from "next"

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
  searchParams: Promise<{ signup?: string }>
}) {
  const { signup } = await searchParams
  return <LoginForm showSuccess={signup === "success"} />
}
