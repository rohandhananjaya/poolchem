import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { requireSuperAdmin } from "@/lib/auth"
import { getServerDiagnostics } from "@/lib/db/admin-diagnostics"
import { Shell } from "@/components/ui/shell"
import { DiagnosticsTabs } from "@/components/admin/DiagnosticsTabs"

export const dynamic = "force-dynamic"

export default async function DiagnosticsPage() {
  await requireSuperAdmin()

  const diagnostics = await getServerDiagnostics()

  return (
    <Shell title="Diagnostics">
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted"
            aria-label="Back to admin"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            System Diagnostics
          </h1>
        </div>

        <DiagnosticsTabs diagnostics={diagnostics} />
      </div>
    </Shell>
  )
}
