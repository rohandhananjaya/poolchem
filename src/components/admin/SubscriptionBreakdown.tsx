"use client"

import * as React from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

import { cssVar } from "@/lib/utils"
import type { SubscriptionBreakdownItem } from "@/lib/db/admin-dashboard"

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Trialing",
  canceled: "Canceled",
  incomplete: "Incomplete",
  past_due: "Past Due",
  none: "No Subscription",
}

export function SubscriptionBreakdown({
  data,
}: {
  data: SubscriptionBreakdownItem[]
}) {
  const [chartColors] = React.useState<string[]>(() =>
    ["--color-chart-1", "--color-chart-2", "--color-chart-3", "--color-chart-4", "--color-chart-5"].map(
      (v, i) => cssVar(v, ["oklch(0.87 0 0)", "oklch(0.556 0 0)", "oklch(0.439 0 0)", "oklch(0.371 0 0)", "oklch(0.269 0 0)"][i]),
    ),
  )

  const total = data.reduce((sum, item) => sum + item.count, 0)

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-sm font-medium text-card-foreground">
        Subscription Status
      </p>

      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No subscription data.
        </p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="h-32 w-32 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={28}
                  outerRadius={48}
                  strokeWidth={0}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={entry.status}
                      fill={chartColors[index % chartColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-lg)",
                    fontSize: 13,
                  }}
                  formatter={(value, name) => {
                    const num = typeof value === "number" ? value : 0
                    return [
                      `${num} (${total > 0 ? Math.round((num / total) * 100) : 0}%)`,
                      STATUS_LABELS[String(name)] ?? String(name),
                    ]
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col gap-1.5">
            {data.map((item, index) => (
              <div key={item.status} className="flex items-center gap-2 text-xs">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: chartColors[index % chartColors.length] }}
                />
                <span className="text-muted-foreground">
                  {STATUS_LABELS[item.status] ?? item.status}
                </span>
                <span className="ml-auto font-medium tabular-nums text-card-foreground">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
