import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth"
import { getCompanyById } from "@/lib/db/company"
import { Shell } from "@/components/ui/shell"
import { ProfileForms } from "@/components/profile/ProfileForms"

export default async function ProfilePage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }

  const company = await getCompanyById(user.companyId)

  return (
    <Shell title="Profile">
      <ProfileForms
        account={{ name: user.name, email: user.email, role: user.role }}
        company={{
          name: company?.name ?? "",
          email: company?.email ?? "",
          phone: company?.phone ?? null,
          address: company?.address ?? null,
        }}
        canEditCompany={user.role === "OWNER"}
      />
    </Shell>
  )
}
