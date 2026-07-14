import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowRight, Waves } from "lucide-react"

import { getCurrentUser } from "@/lib/auth"
import { getCompanyById } from "@/lib/db/company"
import { getPoolsByCompany } from "@/lib/db/pools"
import { Button } from "@/components/ui/button"
import { OnboardingForm } from "./onboarding-form"

export const dynamic = "force-dynamic"

export default async function OnboardingPage() {
  const user = await getCurrentUser()
  if (!user || !user.companyId) {
    redirect("/login")
  }

  const company = await getCompanyById(user.companyId)
  const pools = await getPoolsByCompany(user.companyId)

  const hasPhoneOrAddress = company?.phone || company?.address
  const hasPools = pools.length > 0

  return (
    <div className="flex flex-1 items-start justify-center px-4 py-16">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="space-y-1.5 text-center">
          <span className="inline-flex items-center justify-center size-12 rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 mx-auto">
            <Waves className="size-6" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground mt-4">
            Welcome to Poolbench{company ? `, ${company.name}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            Let&apos;s get your company set up. You can always change these later.
          </p>
        </div>

        <OnboardingForm
          company={{ hasPhoneOrAddress: !!hasPhoneOrAddress, phone: company?.phone ?? null, address: company?.address ?? null }}
          hasPools={hasPools}
          poolsCount={pools.length}
        />

        {/* Go to dashboard */}
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            {hasPools
              ? "Your company is all set up. Start managing your pools!"
              : "Skipped the pool setup? You can always add pools later."}
          </p>
          <Button asChild size="lg" className="w-full">
            <Link href="/dashboard">
              Go to dashboard
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
