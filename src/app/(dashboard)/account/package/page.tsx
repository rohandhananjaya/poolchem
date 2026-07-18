import { redirect } from "next/navigation"
import { Check, X, Clock } from "lucide-react"

import { getCurrentUser, requireAuth } from "@/lib/auth"
import { getAllPackages, getCompanyPackage } from "@/lib/db/packages"
import { Shell } from "@/components/ui/shell"
import { PackageBadge } from "@/components/package/package-badge"
import { PayNowDialog } from "@/components/package/pay-now-dialog"
import { isTrialExpired, formatPrice, getPlanFeatureMatrix } from "@/lib/package-features"

export const dynamic = "force-dynamic"

export default async function AccountPackagePage() {
  await requireAuth()
  const user = await getCurrentUser()
  if (!user?.companyId) redirect("/dashboard")

  const [companyPackage, allPackages] = await Promise.all([
    getCompanyPackage(user.companyId),
    getAllPackages(),
  ])

  if (!companyPackage) redirect("/dashboard")

  const expired = isTrialExpired(companyPackage)
  const featureMatrix = getPlanFeatureMatrix()

  return (
    <Shell title="Your Plan">
      <div className="space-y-8">
        {/* Current package card */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-foreground">
                  {companyPackage.package.name}
                </h2>
                <PackageBadge companyPackage={companyPackage} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {companyPackage.package.price === 0
                  ? "Free"
                  : formatPrice(companyPackage.package.price) + "/mo"}
              </p>
            </div>
          </div>

          {companyPackage.status === "TRIAL" && companyPackage.trialEnd && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <Clock className="size-4" />
              {expired
                ? "Your trial has ended."
                : `Trial ends ${companyPackage.trialEnd.toLocaleDateString()}`}
            </div>
          )}

          {companyPackage.status === "EXPIRED" && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
              <Clock className="size-4" />
              Your trial has ended. Choose a plan below to continue using Poolbench.
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Object.entries(companyPackage.package.features).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2 text-sm">
                {value !== false && value !== 0 ? (
                  <Check className="size-4 shrink-0 text-emerald-500" />
                ) : (
                  <X className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="text-foreground">
                  {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* All plans comparison */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Compare plans
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {allPackages.map((pkg) => {
              const isCurrent = pkg.id === companyPackage.package.id
              return (
                <div
                  key={pkg.id}
                  className={`rounded-xl border p-5 ${
                    isCurrent
                      ? "border-teal-500 bg-teal-50 dark:bg-teal-950/20"
                      : "border-border bg-card"
                  }`}
                >
                  <h3 className="text-base font-semibold text-foreground">{pkg.name}</h3>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {pkg.price === 0 ? "Free" : formatPrice(pkg.price)}
                    {pkg.price > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                  </p>

                  <ul className="mt-4 space-y-2">
                    {featureMatrix.map((row) => {
                      const val = pkg.slug === "starter" ? row.starter : pkg.slug === "basic" ? row.basic : row.pro
                      return (
                        <li key={row.feature} className="flex items-center gap-2 text-sm">
                          {val ? (
                            <Check className="size-3.5 shrink-0 text-emerald-500" />
                          ) : (
                            <X className="size-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <span className="text-muted-foreground">{row.feature}</span>
                        </li>
                      )
                    })}
                  </ul>

                  <div className="mt-6">
                    {isCurrent ? (
                      <p className="text-center text-xs text-muted-foreground">
                        Current plan
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {companyPackage.status === "ACTIVE" && pkg.price > companyPackage.package.price && (
                          <PayNowDialog
                            pkg={pkg}
                            trigger={
                              <button
                                type="button"
                                className="w-full rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
                              >
                                Upgrade to {pkg.name}
                              </button>
                            }
                          />
                        )}
                        {companyPackage.status === "EXPIRED" && (
                          <PayNowDialog
                            pkg={pkg}
                            trigger={
                              <button
                                type="button"
                                className="w-full rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
                              >
                                Pay {formatPrice(pkg.price)}
                              </button>
                            }
                          />
                        )}
                        {(companyPackage.status === "TRIAL" || companyPackage.status === "CANCELLED") && (
                          <PayNowDialog
                            pkg={pkg}
                            trigger={
                              <button
                                type="button"
                                className="w-full rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
                              >
                                Pay {formatPrice(pkg.price)}
                              </button>
                            }
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </Shell>
  )
}
