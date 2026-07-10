"use client"

import { AlertCircle, AlertTriangle, Info, ScrollText } from "lucide-react"

import type { LogSummary } from "@/lib/db/admin-diagnostics"

export function LogSummaryCards({ logSummary }: { logSummary: LogSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <ScrollText className="size-4 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground">Total Logs</p>
        </div>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-card-foreground">
          {logSummary.total}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="size-4 text-red-500" />
          <p className="text-xs font-medium text-muted-foreground">Errors (24h)</p>
        </div>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-card-foreground">
          {logSummary.errors24h}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500" />
          <p className="text-xs font-medium text-muted-foreground">Warnings (24h)</p>
        </div>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-card-foreground">
          {logSummary.warnings24h}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Info className="size-4 text-blue-500" />
          <p className="text-xs font-medium text-muted-foreground">Errors (7d)</p>
        </div>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-card-foreground">
          {logSummary.errors7d}
        </p>
      </div>
    </div>
  )
}
