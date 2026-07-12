import { notFound } from "next/navigation"

import { requireSuperAdmin } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Shell } from "@/components/ui/shell"
import { CompanyEditForm } from "./company-edit-form"
import { getCompanyAuditLogs } from "@/lib/db/admin-audit"
import { TenantLogViewer } from "@/components/admin/TenantLogViewer"

export const dynamic = "force-dynamic"

export default async function AdminCompanyEditPage({
  params,
}: {
  params: Promise<{ companyId: string }>
}) {
  await requireSuperAdmin()

  const { companyId } = await params

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      _count: { select: { users: true, pools: true } },
      users: { orderBy: { createdAt: "asc" } },
    },
  })

  if (!company) notFound()

  const auditLogs = await getCompanyAuditLogs(companyId)

  return (
    <Shell title={company.name} backHref="/admin/companies">
      <CompanyEditForm company={company} />

      <div className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Activity Log
        </h2>
        <TenantLogViewer logs={auditLogs} />
      </div>
    </Shell>
  )
}
