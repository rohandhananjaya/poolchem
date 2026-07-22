"use client"

import * as React from "react"
import Papa from "papaparse"
import { Download } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { UpgradeDialog } from "@/components/upgrade-dialog"
import { exportPoolsAction } from "@/app/(dashboard)/pools/actions"
import { POOL_CSV_EXPORT_COLUMNS } from "@/lib/csv/pool-csv"

export function ExportPoolsButton({
  canImportExport,
}: {
  canImportExport: boolean
}) {
  const [pending, startTransition] = React.useTransition()

  if (!canImportExport) {
    return <UpgradeDialog featureName="CSV export" buttonLabel="Export" />
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await exportPoolsAction()
          if (result.ok && result.data) {
            const csv = Papa.unparse(result.data, {
              columns: [...POOL_CSV_EXPORT_COLUMNS],
            })
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `pools-export-${new Date().toISOString().slice(0, 10)}.csv`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            toast.success("Pools exported.")
          } else if (result.error) {
            toast.error(result.error)
          }
        })
      }
    >
      <Download />
      {pending ? "Exporting…" : "Export"}
    </Button>
  )
}
