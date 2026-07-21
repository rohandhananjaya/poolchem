import { redirect } from "next/navigation"

import { getCurrentUser, requireOwner } from "@/lib/auth"
import { getApiKeysByCompany } from "@/lib/db/api-keys"
import { getCompanyPackage } from "@/lib/db/packages"
import { checkFeatureAccess } from "@/lib/package-features"
import { Shell } from "@/components/ui/shell"
import { ApiKeysManager } from "@/components/account/ApiKeysManager"

export const dynamic = "force-dynamic"

export default async function ApiKeysPage() {
  await requireOwner()
  const user = await getCurrentUser()
  if (!user?.companyId) redirect("/dashboard")

  const [companyPackage, keys] = await Promise.all([
    getCompanyPackage(user.companyId),
    getApiKeysByCompany(user.companyId),
  ])

  const canUseApiKeys =
    !!companyPackage && checkFeatureAccess(companyPackage, "api_access")

  return (
    <Shell title="API Keys">
      <ApiKeysManager canUseApiKeys={canUseApiKeys} keys={keys} />
    </Shell>
  )
}
