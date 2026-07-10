"use client"

import * as React from "react"
import { AlertCircle, AlertTriangle, Info } from "lucide-react"

import type { SystemLogEntry } from "@/lib/db/admin-diagnostics"

const LEVEL_ICONS = {
  ERROR: AlertCircle,
  WARNING: AlertTriangle,
  INFO: Info,
} as const

const LEVEL_STYLES = {
  ERROR:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
  WARNING:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  INFO: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400",
} as const

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date)
}

export function SystemLogViewer({ logs }: { logs: SystemLogEntry[] }) {
  const [filter, setFilter] = React.useState<string>("ALL")
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())

  const filtered = filter === "ALL" ? logs : logs.filter((l) => l.level === filter)

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {["ALL", "ERROR", "WARNING", "INFO"].map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => setFilter(level)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === level
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {level === "ALL" ? "All" : level}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No logs to display.
          </p>
        )}
        {filtered.map((log) => {
          const Icon = LEVEL_ICONS[log.level as keyof typeof LEVEL_ICONS] ?? Info
          const isExpanded = expanded.has(log.id)
          return (
            <div
              key={log.id}
              className="rounded-lg border border-border bg-card"
            >
              <button
                type="button"
                onClick={() => toggleExpand(log.id)}
                className="flex w-full items-start gap-3 p-3 text-left"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${LEVEL_STYLES[log.level as keyof typeof LEVEL_STYLES] ?? ""}`}
                    >
                      {log.level}
                    </span>
                    {log.context ? (
                      <span className="text-[10px] text-muted-foreground">
                        {log.context}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-foreground">{log.message}</p>
                </div>
                <time className="shrink-0 text-[10px] text-muted-foreground">
                  {formatTimestamp(log.createdAt)}
                </time>
              </button>
              {isExpanded && (log.stack || log.metadata) ? (
                <div className="border-t border-border px-3 pb-3 pt-2">
                  {log.stack ? (
                    <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-[10px] text-muted-foreground">
                      {log.stack}
                    </pre>
                  ) : null}
                  {log.metadata ? (
                    <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-[10px] text-muted-foreground">
                      {log.metadata}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
