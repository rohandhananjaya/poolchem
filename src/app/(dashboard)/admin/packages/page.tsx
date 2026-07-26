import { Package as PackageIcon, Plus, Pencil, Trash2, Clock, CreditCard, Bug } from "lucide-react"

import { requireSuperAdmin } from "@/lib/auth"
import { getAllPackages } from "@/lib/db/packages"
import { getPlatformSettings } from "@/lib/db/platform-settings"
import { getPaymentSettings } from "@/lib/db/payment-settings"
import { Shell } from "@/components/ui/shell"
import { Button } from "@/components/ui/button"
import {
  deletePackageAction,
  createPackageAction,
  updatePackageAction,
  updateTrialDaysAction,
  updatePaymentSettingsAction,
} from "./actions"
import { PackageFeatureFields } from "@/components/package/package-feature-fields"
import { formatPrice } from "@/lib/package-features"

export const dynamic = "force-dynamic"

export default async function AdminPackagesPage() {
  await requireSuperAdmin()

  const [packages, platformSettings, paymentSettings] = await Promise.all([
    getAllPackages(),
    getPlatformSettings(),
    getPaymentSettings(),
  ])

  return (
    <Shell title="Packages">
      <div className="space-y-8">
        {/* Platform Settings */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Platform Settings</h2>
          <div className="rounded-xl border border-border bg-card p-4">
            <form action={updateTrialDaysAction} className="flex items-end gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-1">
                  <Clock className="size-3.5" />
                  Trial length (days)
                </label>
                <input
                  name="trialDays"
                  type="number"
                  min="1"
                  defaultValue={platformSettings.trialDays}
                  className="w-32 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <Button type="submit" size="sm">Save</Button>
              <p className="text-xs text-muted-foreground">
                Every new company gets full feature access for this many days before choosing a plan.
              </p>
            </form>
          </div>
        </section>

        {/* Payment Provider Settings */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Payment Providers</h2>
          <div className="rounded-xl border border-border bg-card p-4">
            <form action={updatePaymentSettingsAction} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="checkbox"
                    name="stripeEnabled"
                    defaultChecked={paymentSettings.stripeEnabled}
                    className="size-4 accent-brand-600"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <CreditCard className="size-4" />
                      Stripe
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Credit/debit card payments via Stripe Checkout
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="checkbox"
                    name="paypalEnabled"
                    defaultChecked={paymentSettings.paypalEnabled}
                    className="size-4 accent-brand-600"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z"/>
                      </svg>
                      PayPal
                    </div>
                    <p className="text-xs text-muted-foreground">
                      PayPal subscriptions
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Bug className="size-4" />
                  Mode:
                </label>
                <select
                  name="paymentDevMode"
                  defaultValue={paymentSettings.paymentDevMode ? "sandbox" : "live"}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="sandbox">Sandbox (test)</option>
                  <option value="live">Live (production)</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  {paymentSettings.paymentDevMode
                    ? "Using test/sandbox API keys"
                    : "Using live API keys"}
                </p>
              </div>

              <Button type="submit" size="sm">Save Payment Settings</Button>
            </form>
          </div>
        </section>

        {/* Package Definitions */}
        <section>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-foreground">Plan Definitions</h2>
            <details className="relative">
              <summary className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80">
                <Plus className="size-4" />
                Add Package
              </summary>
              <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-card p-4 shadow-lg">
                <form action={createPackageAction} className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Slug</label>
                      <input name="slug" required className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Name</label>
                      <input name="name" required className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Price ($)</label>
                    <input name="price" type="number" min="0" step="0.01" defaultValue="0" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                  </div>
                  <PackageFeatureFields />
                  <Button type="submit" size="sm" className="w-full">Create</Button>
                </form>
              </div>
            </details>
          </div>

          <div className="space-y-3">
            {packages.map((pkg) => (
              <div key={pkg.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <PackageIcon className="size-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">{pkg.name}</h3>
                      <span className="text-xs text-muted-foreground">({pkg.slug})</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatPrice(pkg.price)}/mo · max {pkg.features.max_pools || 0} pools
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <details className="relative">
                      <summary className="inline-flex cursor-pointer items-center justify-center size-7 rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted">
                        <Pencil className="size-3.5" />
                      </summary>
                      <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-card p-4 shadow-lg">
                        <form action={updatePackageAction} className="space-y-2 text-sm">
                          <input type="hidden" name="id" value={pkg.id} />
                          <div>
                            <label className="block text-xs font-medium text-foreground mb-1">Name</label>
                            <input name="name" defaultValue={pkg.name} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-foreground mb-1">Price ($)</label>
                            <input name="price" type="number" min="0" step="0.01" defaultValue={(pkg.price / 100).toFixed(2)} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs" />
                          </div>
                          <PackageFeatureFields features={pkg.features} />
                          <Button type="submit" size="xs" className="w-full">Save</Button>
                        </form>
                      </div>
                    </details>
                    <form action={deletePackageAction}>
                      <input type="hidden" name="id" value={pkg.id} />
                      <button type="submit" className="inline-flex items-center justify-center size-7 rounded-lg border border-border bg-background text-muted-foreground hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="size-3.5" />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </Shell>
  )
}
