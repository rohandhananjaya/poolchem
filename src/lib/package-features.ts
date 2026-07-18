import type { CompanyPackageStatus } from "@/generated/prisma/client"

export interface PackageFeatures {
  max_pools: number
  health_scoring: "basic" | "advanced+lsi"
  chemical_recs: boolean
  service_reports: boolean
  qr_code: boolean
  scheduling: boolean
  multi_tech: boolean
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
  features: PackageFeatures
  trialDays: number
  sortOrder: number
}

export interface CompanyPackageInfo {
  package: PackageInfo
  status: CompanyPackageStatus
  trialStart: Date | null
  trialEnd: Date | null
  paidAt: Date | null
}

export function parseFeatures(json: string): PackageFeatures {
  return JSON.parse(json) as PackageFeatures
}

export function checkFeatureAccess(
  companyPackage: CompanyPackageInfo,
  feature: keyof PackageFeatures,
): boolean {
  const value = companyPackage.package.features[feature]

  if (typeof value === "boolean") return value
  if (typeof value === "number") {
    if (value === -1) return true // unlimited
    return value > 0
  }

  return false
}

export function isTrialExpired(companyPackage: CompanyPackageInfo): boolean {
  if (companyPackage.status !== "TRIAL") return false
  if (!companyPackage.trialEnd) return false
  return new Date() > companyPackage.trialEnd
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function getPlanFeatureMatrix(): {
  feature: string
  starter: string | boolean
  basic: string | boolean
  pro: string | boolean
}[] {
  return [
    { feature: "Max pools", starter: "5", basic: "25", pro: "Unlimited" },
    { feature: "Water health scoring", starter: "Basic", basic: "Advanced + LSI", pro: "Advanced + LSI" },
    { feature: "Chemical dose recommendations", starter: true, basic: true, pro: true },
    { feature: "Service reports", starter: false, basic: true, pro: true },
    { feature: "QR code visit start", starter: false, basic: true, pro: true },
    { feature: "Scheduling & history", starter: false, basic: true, pro: true },
    { feature: "Multi-tech support", starter: false, basic: false, pro: true },
    { feature: "Priority support", starter: false, basic: false, pro: true },
    { feature: "Custom branding", starter: false, basic: false, pro: true },
    { feature: "API access", starter: false, basic: false, pro: true },
    { feature: "CSV import", starter: false, basic: false, pro: true },
  ]
}
