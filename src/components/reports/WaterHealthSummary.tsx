import { AlertTriangle, CheckCircle2 } from "lucide-react"

import { cn } from "@/lib/utils"
import type { LSIResult, WaterHealthResult } from "@/lib/pool-chemistry"
import { WaterHealthGauge } from "@/components/visits/WaterHealthGauge"

export interface WaterHealthSummaryProps {
  waterHealth: WaterHealthResult | null
  lsi?: LSIResult | null
}

/** The gauge + at-a-glance callout shown at the top of a service report. */
export function WaterHealthSummary({ waterHealth, lsi }: WaterHealthSummaryProps) {
  return (
    <section className="mt-6 flex flex-col items-center gap-5 rounded-xl bg-muted/40 p-5 sm:flex-row sm:justify-center sm:gap-8 print:mt-0 print:pt-10 print:break-inside-avoid print:bg-transparent">
      {waterHealth ? (
        <>
          <WaterHealthGauge
            score={waterHealth.score}
            status={waterHealth.status}
            lsi={lsi}
          />
          <div
            className={cn(
              "flex w-full min-w-0 max-w-sm items-start gap-2.5 rounded-lg p-3",
              waterHealth.issues.length === 0
                ? "bg-emerald-50 dark:bg-emerald-950/30"
                : "bg-amber-50 dark:bg-amber-950/30",
            )}
          >
            {waterHealth.issues.length === 0 ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <div className="min-w-0 space-y-1.5">
              {waterHealth.issues.length === 0 ? (
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  All parameters are within their ideal range — your water is
                  in great shape.
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    {waterHealth.issues.length} item
                    {waterHealth.issues.length > 1 ? "s" : ""} to keep an eye
                    on:
                  </p>
                  <ul className="space-y-1">
                    {waterHealth.issues.map((issue, i) => (
                      <li
                        key={i}
                        className="text-xs text-amber-700 dark:text-amber-400"
                      >
                        {issue}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No water readings were recorded for this visit.
        </p>
      )}
    </section>
  )
}
