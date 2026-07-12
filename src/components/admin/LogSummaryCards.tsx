"use client"

import { AlertCircle, AlertTriangle, Info, ScrollText } from "lucide-react"

import { StatTile } from "@/components/ui/stat-tile"
import type { LogSummary } from "@/lib/db/admin-diagnostics"

export function LogSummaryCards({ logSummary }: { logSummary: LogSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        label="Total Logs"
        value={logSummary.total}
        icon={<ScrollText className="size-4 text-muted-foreground" />}
        size="sm"
      />
      <StatTile
        label="Errors (24h)"
        value={logSummary.errors24h}
        icon={<AlertCircle className="size-4 text-red-500" />}
        size="sm"
      />
      <StatTile
        label="Warnings (24h)"
        value={logSummary.warnings24h}
        icon={<AlertTriangle className="size-4 text-amber-500" />}
        size="sm"
      />
      <StatTile
        label="Errors (7d)"
        value={logSummary.errors7d}
        icon={<Info className="size-4 text-blue-500" />}
        size="sm"
      />
    </div>
  )
}
