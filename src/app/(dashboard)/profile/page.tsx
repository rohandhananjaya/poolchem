import { redirect } from "next/navigation"

import { requireTech } from "@/lib/auth"
import { getCompanyById } from "@/lib/db/company"
import { getOrCreateCompanyPackage } from "@/lib/db/packages"
import { checkFeatureAccess } from "@/lib/package-features"
import { Shell } from "@/components/ui/shell"
import { ProfileForms } from "@/components/profile/ProfileForms"
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
    <Shell title="Profile">
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
      />
    </Shell>
  )
}
