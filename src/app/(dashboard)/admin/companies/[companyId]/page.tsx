import { notFound } from "next/navigation"

import { requireSuperAdmin } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Shell } from "@/components/ui/shell"
import { CompanyEditForm } from "./company-edit-form"

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

  return (
    <Shell title={company.name} backHref="/admin/companies">
      <CompanyEditForm company={company} />
    </Shell>
  )
}
