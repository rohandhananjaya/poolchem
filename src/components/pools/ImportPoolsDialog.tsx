"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Papa from "papaparse"
import { Upload, Lock } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  importPoolsAction,
  type ImportPoolsResult,
} from "@/app/(dashboard)/pools/actions"

interface ParsedCsv {
  fields: string[]
  rows: Record<string, string>[]
}

export function ImportPoolsDialog({
  canImportExport,
}: {
  canImportExport: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const [parsed, setParsed] = React.useState<ParsedCsv | null>(null)
  const [result, setResult] = React.useState<ImportPoolsResult | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  function reset() {
    setParsed(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const { data, meta } = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    })
    setResult(null)
    setParsed({ fields: meta.fields ?? [], rows: data })
  }

  function handleImport() {
    if (!parsed) return
    startTransition(async () => {
      const res = await importPoolsAction(parsed.fields, parsed.rows)
      if (!res.ok) {
        toast.error(res.error ?? "Could not import the CSV.")
        reset()
        return
      }
      setResult(res)
      if (res.imported > 0) router.refresh()
    })
  }

  function handleDone() {
    setOpen(false)
    reset()
  }

  if (!canImportExport) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground">
        <Lock className="size-4 shrink-0" />
        CSV import is available on paid plans — see{" "}
        <a href="/account/package" className="underline underline-offset-2">
          plans
        </a>
        .
      </div>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="lg">
          <Upload />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import pools from CSV</DialogTitle>
          <DialogDescription>
            Required columns: name, volume. Optional: address, homeownerEmail,
            homeownerPhone, notes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={pending}
            className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
          />

          {parsed && !result ? (
            <div className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium text-foreground">
                {parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"}{" "}
                detected
              </p>
              <p className="mt-1 text-muted-foreground">
                Columns: {parsed.fields.join(", ") || "none detected"}
              </p>
            </div>
          ) : null}

          {result ? (
            <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
              <p className="font-medium text-foreground">
                Imported {result.imported} pool
                {result.imported === 1 ? "" : "s"}.
              </p>
              {result.skipped.length > 0 ? (
                <>
                  <p className="text-muted-foreground">
                    {result.skipped.length} row
                    {result.skipped.length === 1 ? "" : "s"} skipped:
                  </p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md bg-muted/50 p-2 text-muted-foreground">
                    {result.skipped.map((skip, i) => (
                      <li key={i}>
                        Row {skip.row}: {skip.reason}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {result ? (
            <Button type="button" onClick={handleDone}>
              Done
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={pending || !parsed}
              >
                {pending ? "Importing…" : "Import"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
