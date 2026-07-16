import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Sign In | Poolbench",
  description:
    "Sign in to your Poolbench account to manage your pool-service company, track visits, and generate water-health reports.",
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ signup?: string }>
}) {
  const { signup } = await searchParams
  const params = signup === "success" ? "?signup=success" : ""
  redirect(`/login${params}`)
}
