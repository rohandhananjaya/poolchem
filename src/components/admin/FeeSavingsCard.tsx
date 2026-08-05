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
import { Scale } from "lucide-react"

import { cssVar } from "@/lib/utils"
import type { FeeSavingsData} from "@/lib/db/fee-savings"

/** Cents → whole dollars, trimmed (e.g. 1250 → "$12.50"). */
function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function useChartColors() {
  const [colors] = React.useState(() => ({
    fees: "#0d9488",
    oldModel: cssVar("--color-chart-2", "oklch(0.556 0 0)"),
  }))
  return colors
}

export function FeeSavingsCard({ data }: { data: FeeSavingsData }) {
  const colors = useChartColors()

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Scale className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium text-card-foreground">
          Fee vs. Old-Model Cost
        </p>
        <span className="text-[10px] text-muted-foreground">
          {data.activePools} active pools &middot; {data.legacyPerPoolRate > 0
            ? dollars(data.legacyPerPoolRate)
            : "$0.00"}/pool/mo estimate
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">MTD fees</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-card-foreground">
            {dollars(data.monthToDateFeesCents)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">Old-model MTD</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-card-foreground">
            {dollars(data.monthToDateOldModelCents)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">Estimated saved</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {dollars(data.monthToDateSavingsCents)}
          </p>
        </div>
      </div>

      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.trend} barCategoryGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `$${Math.round(v / 100)}`}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                fontSize: 13,
              }}
              labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              formatter={(value: unknown, name: unknown) => [
                dollars(Number(value)),
                name === "fees" ? "Platform fees" : "Old-model estimate",
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar
              dataKey="fees"
              name="Platform fees"
              fill={colors.fees}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="oldModel"
              name="Old-model estimate"
              fill={colors.oldModel}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}