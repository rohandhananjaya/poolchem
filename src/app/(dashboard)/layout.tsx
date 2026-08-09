import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth"
import { getCompanyById } from "@/lib/db/company"
import { getOrCreateCompanyPackage } from "@/lib/db/packages"
import { createClient } from "@/lib/supabase/server"
import { MainNav } from "@/components/navigation/main-nav"
import { TopBar } from "@/components/navigation/top-bar"
import { NotificationProvider } from "@/components/notifications/NotificationProvider"
import { PushRegistration } from "@/components/notifications/PushRegistration"
import { AppPrecacheGate } from "@/components/offline/app-precache-gate"
import { IdleRoutePrefetch } from "@/components/offline/idle-route-prefetch"
import { TrialBanner } from "@/components/package/trial-banner"
import type { UserRole } from "@/generated/prisma/client"
import type { CompanyPackageInfo } from "@/lib/package-features"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }

  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  const avatarUrl: string | null =
    authData?.user?.user_metadata?.avatar_url ?? null

  const company = user.companyId
    ? await getCompanyById(user.companyId)
    : null

  let companyPackage: CompanyPackageInfo | null = null
  if (user.companyId) {
    companyPackage = await getOrCreateCompanyPackage(user.companyId)
  }

  return (
    <AppPrecacheGate role={user.role as UserRole} companyId={company?.id ?? null}>
      <NotificationProvider userId={user.id}>
        <div className="flex min-h-svh flex-col" suppressHydrationWarning>
          <MainNav
            user={{ name: user.name, email: user.email, role: user.role as UserRole, image: avatarUrl }}
            company={{ name: company?.name ?? "Poolbench", logo: company?.logo ?? null }}
            companyPackage={companyPackage ?? undefined}
          />
          <TopBar user={{ name: user.name, email: user.email, role: user.role as UserRole, image: avatarUrl }} />
          {/* Offset for the fixed desktop sidebar, the fixed top bar, and the
              fixed mobile bottom bar. */}
          <main className="flex flex-1 flex-col pt-16 pb-20 md:pb-0 md:pl-64 print:pt-0 print:pb-0 print:pl-0">
            {companyPackage && <TrialBanner companyPackage={companyPackage} />}
            {children}
            <PushRegistration />
            {/* Warms router/SW caches for nav routes while idle + mirrors the tenant
                for the offline surfaces. */}
            <IdleRoutePrefetch companyId={company?.id ?? null} />
          </main>
        </div>
      </NotificationProvider>
    </AppPrecacheGate>
  )
}
