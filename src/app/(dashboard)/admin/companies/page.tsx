import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { requireSuperAdmin } from "@/lib/auth"
import { getCompaniesPaginated, COMPANIES_PAGE_SIZE } from "@/lib/db/company"
import { Shell } from "@/components/ui/shell"
import { Pagination } from "@/components/ui/pagination"
import { buildQueryString } from "@/lib/url"
import { CreateCompanyDialog } from "./create-company-dialog"

export const dynamic = "force-dynamic"

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  await requireSuperAdmin()

  const sp = await searchParams
  const currentPage = Math.max(1, Number(sp.page) || 1)

  const { companies, total } = await getCompaniesPaginated(currentPage)

  const totalPages = Math.ceil(total / COMPANIES_PAGE_SIZE)
  const buildHref = (page: number) =>
    `/admin/companies?${buildQueryString(new URLSearchParams(), { page: String(page) })}`

  return (
    <Shell title="Companies">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted"
              aria-label="Back to admin"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Companies
            </h1>
          </div>
          <CreateCompanyDialog />
        </div>

        <div className="space-y-3">
          {companies.map((company) => (
            <Link
              key={company.id}
              href={`/admin/companies/${company.id}`}
              className="block rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {company.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {company.email}
                    {company.phone ? ` · ${company.phone}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-4 text-xs text-muted-foreground">
                  <span>{company._count.users} users</span>
                  <span>{company._count.pools} pools</span>
                </div>
              </div>
              {company.address && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {company.address}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {company.subscriptionStatus
                  ? `Subscription: ${company.subscriptionStatus}`
                  : "No subscription"}
              </p>
            </Link>
          ))}

          {total === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No companies yet.
            </p>
          )}
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          buildHref={buildHref}
          itemLabel="company"
          total={total}
        />
      </div>
    </Shell>
  )
}
