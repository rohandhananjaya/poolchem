import { CheckCircle2, Circle } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ChemicalRecommendation } from "@/lib/pool-chemistry"

export interface ChemicalRecommendationsProps {
  recommendations: ChemicalRecommendation[]
  poolVolume: number
  checked: Record<string, boolean>
  onToggle: (chemical: string) => void
  disabled?: boolean
}

export function ChemicalRecommendations({
  recommendations,
  poolVolume,
  checked,
  onToggle,
  disabled = false,
}: ChemicalRecommendationsProps) {
  if (recommendations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <CheckCircle2 className="size-10 text-emerald-500" />
        <p className="text-sm font-medium text-foreground">
          Water is balanced
        </p>
        <p className="text-xs text-muted-foreground">
          No chemical additions needed
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Amounts calculated for your {poolVolume.toLocaleString()}-gallon pool
      </p>

      <div className="space-y-2">
        {recommendations.map((rec) => {
          const isNA = rec.chemical === "N/A"
          const id = rec.chemical + rec.reason
          return (
            <label
              key={id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors",
                (isNA || disabled) && "cursor-default",
                !isNA && !disabled && "hover:bg-muted/50",
              )}
            >
              {!isNA && !disabled ? (
                <button
                  type="button"
                  onClick={() => onToggle(rec.chemical)}
                  className="mt-0.5 shrink-0"
                >
                  {checked[rec.chemical] ? (
                    <CheckCircle2 className="size-5 text-emerald-500" />
                  ) : (
                    <Circle className="size-5 text-muted-foreground" />
                  )}
                </button>
              ) : null}

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {isNA ? "Partial drain & refill" : rec.chemical}
                  </span>
                  {rec.amount > 0 && (
                    <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                      {rec.amount} {rec.unit}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {rec.reason}
                </p>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}
