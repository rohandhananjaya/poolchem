"use client"

import * as React from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Activity, Cpu, HardDrive } from "lucide-react"

interface DataPoint {
  time: string
  value: number
}

const MAX_POINTS = 600
const POLL_INTERVAL = 1500

function formatMem(mb: number): string {
  if (mb > 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${Math.round(mb)} MB`
}

export function LiveServerCharts() {
  const [cpuHistory, setCpuHistory] = React.useState<DataPoint[]>([])
  const [memoryHistory, setMemoryHistory] = React.useState<DataPoint[]>([])
  const [current, setCurrent] = React.useState<{
    cpuLoadPercent: number
    usedMemoryPercent: number
    usedMemoryMb: number
    totalMemoryMb: number
    processMemoryMb: number
    uptimeSeconds: number
  } | null>(null)

  React.useEffect(() => {
    let mounted = true

    async function poll() {
      try {
        const res = await fetch("/api/stats/live")
        if (!res.ok) return
        const stats = await res.json()
        if (!mounted) return

        setCurrent(stats)

        const time = new Date(stats.timestamp).toLocaleTimeString()

        setCpuHistory((prev) => {
          const next = [...prev, { time, value: stats.cpuLoadPercent }]
          return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next
        })

        setMemoryHistory((prev) => {
          const next = [...prev, { time, value: stats.usedMemoryPercent }]
          return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next
        })
      } catch {
        /* ignore fetch errors */
      }
    }

    poll()

    const id = setInterval(poll, POLL_INTERVAL)

    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  if (!current) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Loading live stats...</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Activity className="size-4" />
        <span>Live Server Health</span>
        <span className="ml-auto text-[10px]">updating every 1.5s</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* CPU */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                CPU Usage
              </span>
            </div>
            <span className="text-lg font-semibold tabular-nums text-card-foreground">
              {current.cpuLoadPercent}%
            </span>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cpuHistory}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                />
                <XAxis dataKey="time" hide />
                <YAxis
                  domain={[0, 100]}
                  hide
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-lg)",
                    fontSize: 13,
                  }}
                  formatter={(value) => [`${value}%`, "CPU"]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-chart-1, oklch(0.6 0.2 30))"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Memory */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                Memory Usage
              </span>
            </div>
            <span className="text-lg font-semibold tabular-nums text-card-foreground">
              {current.usedMemoryPercent}%
            </span>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={memoryHistory}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                />
                <XAxis dataKey="time" hide />
                <YAxis
                  domain={[0, 100]}
                  hide
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-lg)",
                    fontSize: 13,
                  }}
                  formatter={(value) => [`${value}%`, "Memory"]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-chart-2, oklch(0.5 0.2 260))"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[10px] tabular-nums text-muted-foreground">
            {formatMem(current.usedMemoryMb)} / {formatMem(current.totalMemoryMb)} &middot;{" "}
            {current.processMemoryMb} MB process
          </p>
        </div>
      </div>
    </div>
  )
}
