import Link from "next/link"
import { cn } from "@/lib/utils"
import { isTrialExpired, type CompanyPackageInfo } from "@/lib/package-features"

export function PackageBadge({
  companyPackage,
  className,
}: {
  companyPackage: CompanyPackageInfo
  className?: string
}) {
  const expired = isTrialExpired(companyPackage)
  const displayStatus = expired ? "EXPIRED" : companyPackage.status
  const onTrial = companyPackage.status === "TRIAL" && !expired
  const feeBased = companyPackage.feeBased || companyPackage.status === "FEE_BASED"
  const planName = feeBased
    ? "Fee-based"
    : onTrial
      ? "Free Trial"
      : (companyPackage.package?.name ?? "Free Trial")

  const colorMap: Record<string, string> = {
    TRIAL: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    EXPIRED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    CANCELLED: "bg-muted text-muted-foreground",
    FEE_BASED: "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300",
  }

  const labelMap: Record<string, string> = {
    TRIAL: "Trial",
    ACTIVE: "Active",
    EXPIRED: "Expired",
    CANCELLED: "Cancelled",
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        colorMap[displayStatus] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {planName}
      {!feeBased && displayStatus !== "ACTIVE" && ` (${labelMap[displayStatus] ?? displayStatus})`}
    </span>
  )
}

export function PackageBadgeLink({
  companyPackage,
  className,
}: {
  companyPackage: CompanyPackageInfo
  className?: string
}) {
  return (
    <Link href="/account/package" className={cn("hover:opacity-80 transition-opacity", className)}>
      <PackageBadge companyPackage={companyPackage} />
    </Link>
  )
}
