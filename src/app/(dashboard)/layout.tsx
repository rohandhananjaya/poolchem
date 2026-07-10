import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth"
import { getCompanyById } from "@/lib/db/company"
import { MainNav } from "@/components/navigation/main-nav"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }

  const company = await getCompanyById(user.companyId)

  return (
    <div className="flex min-h-svh flex-col">
      <MainNav
        user={{ name: user.name, email: user.email }}
        company={{ name: company?.name ?? "Company", logo: company?.logo ?? null }}
      />
      {/* Offset for the fixed desktop sidebar and the fixed mobile bottom bar. */}
      <main className="flex flex-1 flex-col pb-20 md:pb-0 md:pl-64">
        {children}
      </main>
    </div>
  )
}
