"use client"

import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  Cpu,
  HardDrive,
  Timer,
} from "lucide-react"

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

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
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Timer className="size-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">Uptime</p>
          </div>
          <p className="mt-1 text-lg font-semibold tabular-nums text-card-foreground">
            {formatUptime(server.uptimeSeconds)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <HardDrive className="size-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">Memory</p>
          </div>
          <p className="mt-1 text-lg font-semibold tabular-nums text-card-foreground">
            {server.processMemoryMb} MB
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Cpu className="size-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">CPU Load</p>
          </div>
          <p className="mt-1 text-lg font-semibold tabular-nums text-card-foreground">
            {server.cpuLoadPercent}%
          </p>
        </div>
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
