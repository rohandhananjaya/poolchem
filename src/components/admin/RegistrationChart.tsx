"use client"

import * as React from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

import { cssVar } from "@/lib/utils"
import type { RegistrationTrendItem } from "@/lib/db/admin-dashboard"

function useChartColors() {
  const [colors] = React.useState(() => ({
    users: cssVar("--color-chart-1", "oklch(0.87 0 0)"),
    companies: cssVar("--color-chart-2", "oklch(0.556 0 0)"),
  }))
  return colors
}

export function RegistrationChart({
  data,
}: {
  data: RegistrationTrendItem[]
}) {
  const colors = useChartColors()

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-sm font-medium text-card-foreground">
        New Registrations (14 days)
      </p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap={4}>
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
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            />
            <Bar
              dataKey="users"
              name="Users"
              fill={colors.users}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="companies"
              name="Companies"
              fill={colors.companies}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
