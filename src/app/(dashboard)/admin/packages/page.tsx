import Link from "next/link"
import { Package as PackageIcon, Plus, Pencil, Trash2, Clock } from "lucide-react"

import { requireSuperAdmin } from "@/lib/auth"
import { getAllPackages, getAllCompaniesWithPackages } from "@/lib/db/packages"
import { getPlatformSettings } from "@/lib/db/platform-settings"
import { Shell } from "@/components/ui/shell"
import { Button } from "@/components/ui/button"
import {
  deletePackageAction,
  createPackageAction,
  updatePackageAction,
  adminSetCompanyPackageAction,
  updateTrialDaysAction,
} from "./actions"
import { formatPrice } from "@/lib/package-features"

export const dynamic = "force-dynamic"

export default async function AdminPackagesPage() {
  await requireSuperAdmin()

  const [packages, companies, platformSettings] = await Promise.all([
    getAllPackages(),
    getAllCompaniesWithPackages(),
    getPlatformSettings(),
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
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Price ($)</label>
                      <input name="price" type="number" min="0" step="0.01" defaultValue="0" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Sort Order</label>
                      <input name="sortOrder" type="number" defaultValue="0" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
                    </div>
                  </div>
                  <details className="text-xs">
                    <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">Features</summary>
                    <div className="mt-2 space-y-1.5">
                      <FeatureCheckbox name="features.chemical_recs" label="Chemical Recs" />
                      <FeatureCheckbox name="features.service_reports" label="Service Reports" />
                      <FeatureCheckbox name="features.qr_code" label="QR Code" />
                      <FeatureCheckbox name="features.scheduling" label="Scheduling" />
                      <FeatureCheckbox name="features.multi_tech" label="Multi Tech" />
                      <FeatureCheckbox name="features.priority_support" label="Priority Support" />
                      <FeatureCheckbox name="features.custom_branding" label="Custom Branding" />
                      <FeatureCheckbox name="features.api_access" label="API Access" />
                      <FeatureCheckbox name="features.csv_import" label="CSV Import" />
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Max Pools</label>
                        <input name="features.max_pools" type="number" defaultValue="5" className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Health Scoring</label>
                        <select name="features.health_scoring" defaultValue="basic" className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs">
                          <option value="basic">Basic</option>
                          <option value="advanced+lsi">Advanced + LSI</option>
                        </select>
                      </div>
                    </div>
                  </details>
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
                      {formatPrice(pkg.price)}/mo · Sort: {pkg.sortOrder}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <details className="relative">
                      <summary className="inline-flex cursor-pointer items-center justify-center size-7 rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted">
                        <Pencil className="size-3.5" />
                      </summary>
                      <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-card p-4 shadow-lg">
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

        {/* Companies & their packages */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Companies</h2>
          <div className="space-y-3">
            {companies.map((c) => {
              const cp = c.companyPackage
              const statusColor = cp?.status === "ACTIVE" ? "text-emerald-600" : cp?.status === "TRIAL" ? "text-amber-600" : cp?.status === "EXPIRED" ? "text-red-600" : "text-muted-foreground"
              return (
                <div key={c.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link href={`/admin/companies/${c.id}`} className="text-sm font-semibold text-foreground hover:underline">
                        {c.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {c._count.users} users · {c._count.pools} pools
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {cp ? (
                        <span className={`text-xs font-medium ${statusColor}`}>
                          {cp.package?.name ?? "Trial — no plan chosen"} ({cp.status.toLowerCase()})
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No package</span>
                      )}
                      <details className="relative">
                        <summary className="inline-flex cursor-pointer items-center justify-center size-7 rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted">
                          <Pencil className="size-3.5" />
                        </summary>
                        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-card p-4 shadow-lg">
                          <form action={adminSetCompanyPackageAction} className="space-y-2 text-sm">
                            <input type="hidden" name="companyId" value={c.id} />
                            <div>
                              <label className="block text-xs font-medium text-foreground mb-1">Package</label>
                              <select name="packageId" defaultValue={cp?.package?.id ?? packages[0]?.id} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
                                {packages.map((p) => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-foreground mb-1">Status</label>
                              <select name="status" defaultValue={cp?.status ?? "TRIAL"} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
                                <option value="TRIAL">Trial</option>
                                <option value="ACTIVE">Active</option>
                                <option value="EXPIRED">Expired</option>
                                <option value="CANCELLED">Cancelled</option>
                              </select>
                            </div>
                            <Button type="submit" size="xs" className="w-full">Update</Button>
                          </form>
                        </div>
                      </details>
                    </div>
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

function FeatureCheckbox({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
      <input type="checkbox" name={name} className="size-3.5 accent-teal-600" />
      {label}
    </label>
  )
}
