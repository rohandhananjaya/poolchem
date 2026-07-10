"use client"

import { Cpu, HardDrive, Server, Timer } from "lucide-react"

import type { ServerInfo } from "@/lib/db/admin-diagnostics"

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (d > 0) return `${d}d ${h}h ${m}m ${s}s`
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function ServerHealthDetails({ server }: { server: ServerInfo }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Timer className="size-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">Server Uptime</p>
          </div>
          <p className="mt-1 text-lg font-semibold tabular-nums text-card-foreground">
            {formatUptime(server.uptimeSeconds)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Timer className="size-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">Process Uptime</p>
          </div>
          <p className="mt-1 text-lg font-semibold tabular-nums text-card-foreground">
            {formatUptime(server.processUptimeSeconds)}
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
          <p className="text-[10px] text-muted-foreground">
            {server.cpuCount} cores
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <HardDrive className="size-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">Process Memory</p>
          </div>
          <p className="mt-1 text-lg font-semibold tabular-nums text-card-foreground">
            {server.processMemoryMb} MB
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoTile label="Hostname" value={server.hostname} />
        <InfoTile label="Platform" value={`${server.platform} (${server.arch})`} />
        <InfoTile label="Node.js Version" value={server.nodeVersion} />
        <InfoTile label="Free Memory" value={`${server.freeMemoryMb} MB`} />
      </div>
    </div>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium tabular-nums text-card-foreground">
        {value}
      </p>
    </div>
  )
}
