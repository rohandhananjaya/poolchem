"use client"

import { Cpu, HardDrive, Server, Timer } from "lucide-react"

import { StatTile } from "@/components/ui/stat-tile"
import { formatUptime } from "@/lib/utils"
import type { ServerInfo } from "@/lib/db/admin-diagnostics"

export function ServerHealthDetails({ server }: { server: ServerInfo }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Server Uptime"
          value={formatUptime(server.uptimeSeconds, true)}
          icon={<Timer className="size-4 text-muted-foreground" />}
          size="sm"
        />
        <StatTile
          label="Process Uptime"
          value={formatUptime(server.processUptimeSeconds, true)}
          icon={<Timer className="size-4 text-muted-foreground" />}
          size="sm"
        />
        <StatTile
          label="CPU Load"
          value={`${server.cpuLoadPercent}%`}
          icon={<Cpu className="size-4 text-muted-foreground" />}
          size="sm"
        />
        <StatTile
          label="Process Memory"
          value={`${server.processMemoryMb} MB`}
          icon={<HardDrive className="size-4 text-muted-foreground" />}
          size="sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Hostname" value={server.hostname} size="sm" />
        <StatTile
          label="Platform"
          value={`${server.platform} (${server.arch})`}
          size="sm"
        />
        <StatTile label="Node.js Version" value={server.nodeVersion} size="sm" />
        <StatTile
          label="Free Memory"
          value={`${server.freeMemoryMb} MB`}
          size="sm"
        />
      </div>
    </div>
  )
}
