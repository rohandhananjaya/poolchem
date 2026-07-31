import { redirect } from "next/navigation"
import { Check, X, Clock } from "lucide-react"

import { getCurrentUser, requireAuth } from "@/lib/auth"
import { getAllPackages, getCompanyPackage } from "@/lib/db/packages"
import { getPaymentSettings } from "@/lib/db/payment-settings"
import { Shell } from "@/components/ui/shell"
import { PackageBadge } from "@/components/package/package-badge"
import { PayNowDialog } from "@/components/package/pay-now-dialog"
import { SwitchPlanDialog } from "@/components/package/switch-plan-dialog"
import { PendingDowngradeNotice } from "@/components/package/pending-downgrade-notice"
import { confirmPayPalSubscriptionAction, confirmPayPalUpgradeAction } from "./actions"
import {
  isTrialExpired,
  formatPrice,
  getPlanFeatureMatrix,
  FEATURE_LABELS,
  formatFeatureValue,
} from "@/lib/package-features"

export const dynamic = "force-dynamic"

export default async function AccountPackagePage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string
    cancelled?: string
    subscription_id?: string
    paypal_upgrade?: string
    package?: string
    upgraded?: string
  }>
}) {
  await requireAuth()
  const user = await getCurrentUser()
  if (!user?.companyId) redirect("/dashboard")

  const params = await searchParams
  const justPaid = params.success === "1"
  const justUpgraded = params.paypal_upgrade === "1" && !!params.package

  let activationPending = false
  if (justPaid && params.subscription_id) {
    const result = await confirmPayPalSubscriptionAction(params.subscription_id)
    if (result.ok) {
      // Drop PayPal's subscription_id/ba_token/token from the URL now that
      // they've served their purpose, so they don't linger in browser
      // history or leak via the Referer header on a later page load.
      redirect("/account/package?success=1")
    }
    activationPending = true
  }

  let upgradeConfirmError: string | undefined
  if (justUpgraded) {
    const result = await confirmPayPalUpgradeAction(params.package!)
    if (result.ok) {
      // Same "drop the one-time query params" reasoning as the checkout return above.
      redirect("/account/package?upgraded=1")
    }
    upgradeConfirmError = result.error
  }

  const [companyPackage, allPackages, paymentSettings] = await Promise.all([
    getCompanyPackage(user.companyId),
    getAllPackages(),
    getPaymentSettings(),
  ])

  if (!companyPackage) redirect("/dashboard")

  const expired = isTrialExpired(companyPackage)
  const featureMatrix = getPlanFeatureMatrix(allPackages)
  const sortedPackages = [...allPackages].sort((a, b) => a.price - b.price)
  const onTrial = companyPackage.status === "TRIAL" && !expired
  const isActivePaid = companyPackage.status === "ACTIVE" && !!companyPackage.package

  return (
    <Shell title="Your Plan">
      <div className="space-y-8">
        {justPaid && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
            {activationPending
              ? "Payment received! Finishing activation — refresh the page in a few seconds to see your new plan."
              : "Payment successful! Your subscription is now active."}
          </div>
        )}

        {params.cancelled === "1" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            Payment was cancelled. No charges were made.
          </div>
        )}

        {params.upgraded === "1" && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
            Plan upgraded! Your new plan is now active.
          </div>
        )}

        {upgradeConfirmError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            {upgradeConfirmError}
          </div>
        )}

        {/* Current package card */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-foreground">
                  {onTrial ? "Free Trial" : (companyPackage.package?.name ?? "Free Trial")}
                </h2>
                <PackageBadge companyPackage={companyPackage} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {onTrial
                  ? "Full access, no plan chosen yet"
                  : companyPackage.package
                    ? formatPrice(companyPackage.package.price) + "/mo"
                    : "Full access, no plan chosen yet"}
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

          {companyPackage.pendingPackage && companyPackage.pendingEffectiveAt && (
            <PendingDowngradeNotice
              packageName={companyPackage.pendingPackage.name}
              effectiveAt={companyPackage.pendingEffectiveAt}
            />
          )}

          {onTrial ? (
            <p className="mt-6 text-sm text-muted-foreground">
              All features are unlocked during your trial. Choose a plan below for
              when your trial ends.
            </p>
          ) : (
            companyPackage.package && (
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {FEATURE_LABELS.map(({ key, label }) => {
                  const rawValue = companyPackage.package!.features[key]
                  const displayValue = formatFeatureValue(rawValue)
                  return (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      {rawValue !== false && rawValue !== 0 ? (
                        <Check className="size-4 shrink-0 text-emerald-500" />
                      ) : (
                        <X className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="text-foreground">
                        {label}
                        {typeof displayValue === "string" && (
                          <span className="ml-1 text-muted-foreground">{displayValue}</span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>

        {/* All plans comparison */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Compare plans
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {sortedPackages.map((pkg) => {
              const isCurrent =
                companyPackage.status === "ACTIVE" && companyPackage.package?.id === pkg.id
              return (
                <div
                  key={pkg.id}
                  className={`rounded-xl border p-5 ${
                    isCurrent
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                      : "border-border bg-card"
                  }`}
                >
                  <h3 className="text-base font-semibold text-foreground">{pkg.name}</h3>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {formatPrice(pkg.price)}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>

                  <ul className="mt-4 space-y-2">
                    {featureMatrix.map((row) => {
                      const val = row.values[pkg.slug]
                      return (
                        <li key={row.feature} className="flex items-center gap-2 text-sm">
                          {val ? (
                            <Check className="size-3.5 shrink-0 text-emerald-500" />
                          ) : (
                            <X className="size-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <span className="text-muted-foreground">
                            {row.feature}
                            {typeof val === "string" && (
                              <span className="ml-1 font-medium text-foreground">{val}</span>
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>

                  <div className="mt-6">
                    {isCurrent ? (
                      <p className="text-center text-xs text-muted-foreground">
                        Current plan
                      </p>
                    ) : isActivePaid ? (
                      <SwitchPlanDialog
                        pkg={pkg}
                        currentPrice={companyPackage.package!.price}
                        currentName={companyPackage.package!.name}
                      />
                    ) : (
                      <PayNowDialog
                        pkg={pkg}
                        stripeEnabled={paymentSettings.stripeEnabled}
                        paypalEnabled={paymentSettings.paypalEnabled}
                      />
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
