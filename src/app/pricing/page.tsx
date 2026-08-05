import type { Metadata } from "next"
import Link from "next/link"
import { Check, Droplets } from "lucide-react"

import { getAllPackages } from "@/lib/db/packages"
import { formatPrice, formatFeePercent } from "@/lib/package-features"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Pricing | Poolbench",
  description:
    "One flat monthly price plus a small per-transaction fee — no per-pool or per-tech tiers to outgrow.",
  openGraph: {
    title: "Pricing | Poolbench",
    description:
      "One flat monthly price plus a small per-transaction fee — no per-pool or per-tech tiers to outgrow.",
    url: "/pricing",
  },
  alternates: { canonical: "/pricing" },
}

const HIGHLIGHTS = [
  "Water health scoring & chemical dose recommendations",
  "Scheduling, service reports, and QR-code visit start",
  "Unlimited pools and technicians as you grow",
]

export default async function PricingPage() {
  const packages = await getAllPackages()
  const plan = packages[0]

  return (
    <div className="relative flex min-h-dvh flex-col items-center overflow-hidden bg-gradient-to-br from-brand-200 to-brand-50 px-4 py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden max-md:hidden">
        <div className="absolute -top-40 -right-40 size-[30rem] rounded-full bg-brand-200/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-[30rem] rounded-full bg-brand-50/60 blur-3xl" />
      </div>

      <div className="relative flex w-full max-w-md flex-col items-center text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-brand-600 text-white">
          <Droplets className="size-6" />
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
          One flat price. No tiers to outgrow.
        </h1>
        <p className="mt-2 text-muted-foreground">
          Poolbench charges a flat monthly rate plus a small fee only when you get paid — not per pool, not per
          technician.
        </p>

        {plan ? (
          <div className="mt-8 w-full rounded-2xl border border-border bg-card p-8 shadow-lg">
            <p className="text-sm font-medium text-muted-foreground">{plan.name}</p>
            <p className="mt-2 font-mono text-5xl font-bold tabular-nums text-foreground">
              {plan.price === 0 ? "Free" : `${formatPrice(plan.price)}`}
              {plan.price > 0 && <span className="text-lg font-medium text-muted-foreground">/mo</span>}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              + {formatFeePercent(plan.feePercent)} per transaction
            </p>

            <ul className="mt-6 space-y-2.5 text-left text-sm text-foreground">
              {HIGHLIGHTS.map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-600" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <Button asChild size="lg" className="mt-8 w-full">
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">Pricing is being updated — check back shortly.</p>
        )}

        <p className="mt-6 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
