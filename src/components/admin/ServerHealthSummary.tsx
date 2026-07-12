"use client"

import Link from "next/link"
import {
  AlertTriangle,
  Cpu,
  HardDrive,
  Timer,
} from "lucide-react"

import { StatTile } from "@/components/ui/stat-tile"
import { formatUptime } from "@/lib/utils"

export function ServerHealthSummary({
  server,
  logSummary,
}: {
  server: { uptimeSeconds: number; processMemoryMb: number; cpuLoadPercent: number; platform: string }
  logSummary: { errors24h: number; warnings24h: number }
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Server Health</p>
        <Link
          href="/admin/diagnostics"
          className="text-xs font-medium text-primary hover:underline"
        >
          View full diagnostics &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Uptime"
          value={formatUptime(server.uptimeSeconds)}
          icon={<Timer className="size-4 text-muted-foreground" />}
          size="sm"
        />
        <StatTile
          label="Memory"
          value={`${server.processMemoryMb} MB`}
          icon={<HardDrive className="size-4 text-muted-foreground" />}
          size="sm"
        />
        <StatTile
          label="CPU Load"
          value={`${server.cpuLoadPercent}%`}
          icon={<Cpu className="size-4 text-muted-foreground" />}
          size="sm"
        />
        <Link
          href="/admin/diagnostics"
          className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">Issues (24h)</p>
          </div>
          <p className="mt-1 text-lg font-semibold tabular-nums text-card-foreground">
            {logSummary.errors24h + logSummary.warnings24h > 0 ? (
              <span className="text-amber-500">
                {logSummary.errors24h + logSummary.warnings24h}
              </span>
            ) : (
              <span className="text-green-500">0</span>
            )}
          </p>
        </Link>
      </div>
    </div>
  )
}
