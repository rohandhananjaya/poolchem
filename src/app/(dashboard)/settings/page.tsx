import Link from "next/link"
import { MessageSquare } from "lucide-react"

import { requireTech } from "@/lib/auth"
import { getCompanyById } from "@/lib/db/company"
import { getOrCreateCompanyPackage } from "@/lib/db/packages"
import { checkFeatureAccess } from "@/lib/package-features"
import { Shell } from "@/components/ui/shell"
import { Button } from "@/components/ui/button"
import { ProfileForms } from "@/components/profile/ProfileForms"
import { SignOutButton } from "@/components/profile/SignOutButton"
import type { UserRole } from "@/generated/prisma/client"

export default async function ProfilePage() {
  const user = await requireTech()

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
