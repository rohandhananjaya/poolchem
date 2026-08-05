import type { CompanyPackageStatus } from "@/generated/prisma/client"

export interface PackageFeatures {
  max_pools: number
  health_scoring: "basic" | "advanced+lsi"
  chemical_recs: boolean
  service_reports: boolean
  qr_code: boolean
  scheduling: boolean
  max_techs: number
  priority_support: boolean
  custom_branding: boolean
  api_access: boolean
  csv_import: boolean
}

export interface PackageInfo {
  id: string
  slug: string
  name: string
  price: number
  /** Basis points on top of price (e.g., 250 = 2.5%) charged per transaction. */
  feePercent: number
  features: PackageFeatures
  sortOrder: number
}

export interface CompanyPackageInfo {
  package: PackageInfo | null
  status: CompanyPackageStatus
  trialStart: Date | null
  trialEnd: Date | null
  paidAt: Date | null
  /** Set while a downgrade is scheduled but hasn't taken effect yet. */
  pendingPackage: PackageInfo | null
  pendingEffectiveAt: Date | null
}

export function parseFeatures(json: string): PackageFeatures {
  return JSON.parse(json) as PackageFeatures
}

/**
 * A company on an active (non-expired) trial gets every feature unlocked,
 * regardless of which plan it will eventually pay for. Once the trial ends
 * or a plan is chosen, access follows that plan's `features`.
 */
export function checkFeatureAccess(
  companyPackage: CompanyPackageInfo,
  feature: keyof PackageFeatures,
): boolean {
  if (companyPackage.status === "TRIAL" && !isTrialExpired(companyPackage)) {
    return true
  }

  if (companyPackage.status !== "ACTIVE") return false

  if (!companyPackage.package) return false

  const value = companyPackage.package.features[feature]

  if (typeof value === "boolean") return value
  if (typeof value === "number") {
    if (value === -1) return true // unlimited
    return value > 0
  }

  return false
}

/**
 * The water-health scoring tier a company is entitled to: `"basic"` (the 0–100
 * health score only) or `"advanced+lsi"` (score + Langelier Saturation Index).
 *
 * An active trial unlocks the advanced tier for everyone, mirroring
 * {@link checkFeatureAccess}; otherwise access follows the chosen plan's
 * `health_scoring` feature. A null/expired/cancelled company falls back to
 * basic.
 */
export function getHealthScoringLevel(
  companyPackage: CompanyPackageInfo | null,
): "basic" | "advanced+lsi" {
  if (!companyPackage) return "basic";
  if (companyPackage.status === "TRIAL" && !isTrialExpired(companyPackage)) {
    return "advanced+lsi";
  }
  if (companyPackage.status !== "ACTIVE") return "basic";
  return companyPackage.package?.features.health_scoring ?? "basic";
}

/**
 * Whether a company can add one more pool, given how many it already has.
 * Full access during an active trial; otherwise checked against the chosen
 * plan's `max_pools` (`-1` = unlimited).
 */
export function hasPoolCapacity(
  companyPackage: CompanyPackageInfo,
  currentCount: number,
): boolean {
  if (companyPackage.status === "TRIAL" && !isTrialExpired(companyPackage)) {
    return true
  }

  if (companyPackage.status !== "ACTIVE") return false

  if (!companyPackage.package) return false

  const max = companyPackage.package.features.max_pools
  if (max === -1) return true
  return currentCount < max
}

/**
 * Whether a company can add one more technician, given how many it already
 * has (including pending invitations). Full access during an active trial;
 * otherwise checked against the chosen plan's `max_techs` (`-1` = unlimited).
 */
export function hasTechCapacity(
  companyPackage: CompanyPackageInfo,
  currentCount: number,
): boolean {
  if (companyPackage.status === "TRIAL" && !isTrialExpired(companyPackage)) {
    return true
  }

  if (companyPackage.status !== "ACTIVE") return false

  if (!companyPackage.package) return false

  const max = companyPackage.package.features.max_techs
  if (max === -1) return true
  return currentCount < max
}

export function isTrialExpired(companyPackage: CompanyPackageInfo): boolean {
  if (companyPackage.status !== "TRIAL") return false
  if (!companyPackage.trialEnd) return false
  return new Date() > companyPackage.trialEnd
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/** Basis points → a display string, e.g. 250 -> "2.5%". */
export function formatFeePercent(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(basisPoints % 100 === 0 ? 0 : 1)}%`
}

export const FEATURE_LABELS: { key: keyof PackageFeatures; label: string }[] = [
  { key: "max_pools", label: "Max pools" },
  { key: "health_scoring", label: "Water health scoring" },
  { key: "chemical_recs", label: "Chemical dose recommendations" },
  { key: "service_reports", label: "Service reports" },
  { key: "qr_code", label: "QR code visit start" },
  { key: "scheduling", label: "Scheduling & history" },
  { key: "max_techs", label: "Max technicians" },
  { key: "priority_support", label: "Priority support" },
  { key: "custom_branding", label: "Custom branding" },
  { key: "api_access", label: "API access" },
  { key: "csv_import", label: "CSV import" },
]

export function formatFeatureValue(value: PackageFeatures[keyof PackageFeatures]): string | boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === -1 ? "Unlimited" : String(value)
  if (value === "advanced+lsi") return "Advanced + LSI"
  if (value === "basic") return "Basic"
  return value
}

/**
 * Builds the plan-comparison table straight from each package's real
 * `features`, so an edit in /admin/packages shows up here immediately
 * instead of relying on a separately hand-maintained table.
 */
export function getPlanFeatureMatrix(
  packages: PackageInfo[],
): { feature: string; values: Record<string, string | boolean> }[] {
  return FEATURE_LABELS.map(({ key, label }) => ({
    feature: label,
    values: Object.fromEntries(
      packages.map((pkg) => [pkg.slug, formatFeatureValue(pkg.features[key])]),
    ),
  }))
}
