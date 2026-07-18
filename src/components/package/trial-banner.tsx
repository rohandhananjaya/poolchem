import Link from "next/link"
import { AlertTriangle } from "lucide-react"

import type { CompanyPackageInfo } from "@/lib/package-features"
import { isTrialExpired } from "@/lib/package-features"

function getDaysUntil(end: Date): number {
  return Math.ceil((end.getTime() - Date.now()) / 86400000)
}

export function TrialBanner({
  companyPackage,
}: {
  companyPackage: CompanyPackageInfo
}) {
  const expired = isTrialExpired(companyPackage)

  if (companyPackage.status === "ACTIVE") return null

  if (expired) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 pt-4">
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="size-5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">Your trial has ended</p>
            <p className="text-xs text-red-600 dark:text-red-400">
              Choose a plan to continue using Poolbench.
            </p>
          </div>
          <Link
            href="/account/package"
            className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
          >
            View plans
          </Link>
        </div>
      </div>
    )
  }

  if (companyPackage.status === "TRIAL" && companyPackage.trialEnd) {
    const daysLeft = getDaysUntil(companyPackage.trialEnd)
    if (daysLeft <= 3 && daysLeft > 0) {
      return (
        <div className="mx-auto w-full max-w-5xl px-4 pt-4">
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="size-5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">
                Your trial ends in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Choose a plan to keep access to all features.
              </p>
            </div>
            <Link
              href="/account/package"
              className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
            >
              View plans
            </Link>
          </div>
        </div>
      )
    }
  }

  return null
}
