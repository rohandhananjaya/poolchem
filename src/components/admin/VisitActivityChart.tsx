"use client"

import * as React from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

import { cssVar } from "@/lib/utils"
import type { VisitTrendItem } from "@/lib/db/admin-dashboard"

export function VisitActivityChart({
  data,
}: {
  data: VisitTrendItem[]
}) {
  const [color] = React.useState(() => cssVar("--color-chart-1", "oklch(0.87 0 0)"))

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-sm font-medium text-card-foreground">
        Visit Activity (14 days)
      </p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                fontSize: 13,
              }}
              labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            />
            <Area
              type="monotone"
              dataKey="completed"
              name="Completed"
              stroke={color}
              fill={color}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
