"use client"

import { Server, ScrollText, Database } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LiveServerCharts } from "@/components/admin/LiveServerCharts"
import { ServerHealthDetails } from "@/components/admin/ServerHealthDetails"
import { LogSummaryCards } from "@/components/admin/LogSummaryCards"
import { SystemLogViewer } from "@/components/admin/SystemLogViewer"
import type { DiagnosticsData } from "@/lib/db/admin-diagnostics"

export function DiagnosticsTabs({
  diagnostics,
}: {
  diagnostics: DiagnosticsData
}) {
  return (
    <Tabs defaultValue="server-health">
      <TabsList className="w-fit">
        <TabsTrigger value="server-health" className="cursor-pointer gap-2">
          <Server className="size-4" />
          Server Health
        </TabsTrigger>
        <TabsTrigger value="recent-logs" className="cursor-pointer gap-2">
          <ScrollText className="size-4" />
          Recent Logs
        </TabsTrigger>
        <TabsTrigger value="database-tables" className="cursor-pointer gap-2">
          <Database className="size-4" />
          Database Tables
        </TabsTrigger>
      </TabsList>

      <TabsContent value="server-health">
        <div className="space-y-4">
          <LiveServerCharts />
          <ServerHealthDetails server={diagnostics.server} />
        </div>
      </TabsContent>

      <TabsContent value="recent-logs">
        <div className="space-y-4">
          <LogSummaryCards logSummary={diagnostics.logSummary} />
          <SystemLogViewer logs={diagnostics.recentLogs} />
        </div>
      </TabsContent>

      <TabsContent value="database-tables">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Table
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                    Rows
                  </th>
                </tr>
              </thead>
              <tbody>
                {diagnostics.database.tableRowCounts.map((row) => (
                  <tr key={row.table} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {row.table}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {row.count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Database status:{" "}
            {diagnostics.database.connected ? (
              <span className="font-medium text-green-500">Connected</span>
            ) : (
              <span className="font-medium text-red-500">Disconnected</span>
            )}
          </p>
        </div>
      </TabsContent>
    </Tabs>
  )
}
