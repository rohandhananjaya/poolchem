import { redirect } from "next/navigation"

import { requireTech } from "@/lib/auth"
import { getCompanyById } from "@/lib/db/company"
import { Shell } from "@/components/ui/shell"
import { ProfileForms } from "@/components/profile/ProfileForms"
import type { UserRole } from "@/generated/prisma/client"

export default async function ProfilePage() {
  const user = await requireTech()

  const company = user.companyId
    ? await getCompanyById(user.companyId)
    : null

  const role = user.role as UserRole

  return (
    <Shell title="Profile">
      <ProfileForms
        account={{ name: user.name, email: user.email, role }}
        company={company ? {
          name: company.name,
          email: company.email,
          phone: company.phone,
          address: company.address,
        } : null}
        canEditCompany={role === "OWNER"}
      />
    </Shell>
  )
}
