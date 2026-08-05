import Link from "next/link"
import { redirect } from "next/navigation"
import { MessageSquare } from "lucide-react"

import { requireTech } from "@/lib/auth"
import { getCompanyById, updateCompany } from "@/lib/db/company"
import { getOrCreateCompanyPackage, getDefaultFeePercent } from "@/lib/db/packages"
import { getCompanyTransactions } from "@/lib/db/payment-transactions"
import { getPaymentSettings } from "@/lib/db/payment-settings"
import { checkFeatureAccess } from "@/lib/package-features"
import { getConnectAccountStatus } from "@/lib/payment/connect"
import { Shell } from "@/components/ui/shell"
import { Button } from "@/components/ui/button"
import { ProfileForms } from "@/components/profile/ProfileForms"
import { SignOutButton } from "@/components/profile/SignOutButton"
import { PaymentProcessorCard } from "@/components/settings/PaymentProcessorCard"
import { BillingCard } from "@/components/settings/BillingCard"
import type { UserRole } from "@/generated/prisma/client"

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ stripe_connect?: string }>
}) {
  const user = await requireTech()
  const params = await searchParams

  const role = user.role as UserRole
  const canEditCompany = role === "OWNER"

  const [company, companyPackage] = user.companyId
    ? await Promise.all([
        getCompanyById(user.companyId),
        getOrCreateCompanyPackage(user.companyId),
      ])
    : [null, null]

  const canEditBranding =
    canEditCompany && companyPackage
      ? checkFeatureAccess(companyPackage, "custom_branding")
      : false

  const [feePercent, transactions] = user.companyId
    ? await Promise.all([
        getDefaultFeePercent(),
        getCompanyTransactions(user.companyId, 10),
      ])
    : [0, []]

  const { paymentDevMode } = await getPaymentSettings()

  // Stripe has no onboarding webhook wired up yet, so the "onboarded" flag is
  // refreshed lazily: on the return leg from Stripe's hosted flow, and any
  // time an account exists but hasn't finished onboarding yet.
  let connectOnboarded = company?.stripeConnectOnboarded ?? false
  if (
    company?.stripeConnectAccountId &&
    (params.stripe_connect === "return" || !connectOnboarded)
  ) {
    try {
      const { paymentDevMode } = await getPaymentSettings()
      const status = await getConnectAccountStatus(
        company.stripeConnectAccountId,
        paymentDevMode,
      )
      connectOnboarded = status.chargesEnabled
      if (connectOnboarded !== company.stripeConnectOnboarded) {
        await updateCompany(user.companyId!, { stripeConnectOnboarded: connectOnboarded })
      }
    } catch {
      // Stripe unreachable/misconfigured — fall back to the last-known value.
    }
    if (params.stripe_connect === "return") redirect("/settings")
  }

  return (
    <Shell title="Settings">
      <div className="space-y-6">
        <ProfileForms
          account={{ name: user.name, email: user.email, role }}
          company={company ? {
            name: company.name,
            email: company.email,
            phone: company.phone,
            address: company.address,
            logo: company.logo,
          } : null}
          canEditCompany={canEditCompany}
          canEditBranding={canEditBranding}
          companyPackage={companyPackage}
        />
        {canEditCompany && company ? (
          <PaymentProcessorCard
            connected={!!company.stripeConnectAccountId}
            onboarded={connectOnboarded}
          />
        ) : null}
        {company ? (
          <BillingCard
            feeBased={companyPackage?.feeBased ?? false}
            feePercent={feePercent}
            transactions={transactions}
            canSimulate={canEditCompany && paymentDevMode}
          />
        ) : null}
        <section className="rounded-xl border border-border bg-card p-4 md:p-6">
          <header className="mb-4">
            <h2 className="text-base font-semibold text-card-foreground">
              Feedback & support
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Found a bug or have an idea? Let the platform team know.
            </p>
          </header>
          <Button asChild>
            <Link href="/feedback">
              <MessageSquare className="size-4" />
              Report a problem
            </Link>
          </Button>
        </section>
        <SignOutButton />
      </div>
    </Shell>
  )
}
