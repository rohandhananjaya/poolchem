"use client"

import * as React from "react"
import { History, User, Building2 } from "lucide-react"

import type { AuditLogWithUser } from "@/lib/db/admin-audit"
import type { CompanyOption } from "@/lib/db/admin-diagnostics"

const ACTION_LABELS: Record<string, string> = {
  "company.created": "Company Created",
  "company.updated": "Company Updated",
  "company.deleted": "Company Deleted",
  "user.created": "User Created",
  "user.updated": "User Updated",
  "user.deleted": "User Deleted",
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date)
}

export function TenantLogViewer({
  logs,
  companies,
}: {
  logs: AuditLogWithUser[]
  companies?: CompanyOption[]
}) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())

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
      <div className="space-y-2">
        {logs.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No audit logs for this company yet.
          </p>
        )}
        {logs.map((log) => {
          const isExpanded = expanded.has(log.id)
          let detailsObj: Record<string, unknown> | null = null
          if (log.details) {
            try { detailsObj = JSON.parse(log.details) as Record<string, unknown> } catch { /* skip */ }
          }

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
                <History className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {actionLabel(log.action)}
                    </span>
                    {log.userName ? (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <User className="size-3" />
                        {log.userName}
                      </span>
                    ) : null}
                    {companies ? (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Building2 className="size-3" />
                        {companies.find((c) => c.id === log.companyId)?.name ?? log.companyId}
                      </span>
                    ) : null}
                  </div>
                </div>
                <time className="shrink-0 text-[10px] text-muted-foreground">
                  {formatTimestamp(log.createdAt)}
                </time>
              </button>
              {isExpanded && detailsObj ? (
                <div className="border-t border-border px-3 pb-3 pt-2">
                  <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-[10px] text-muted-foreground">
                    {JSON.stringify(detailsObj, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
