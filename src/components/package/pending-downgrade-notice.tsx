"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Clock } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cancelScheduledDowngradeAction } from "@/app/(dashboard)/account/package/actions"

interface PendingDowngradeNoticeProps {
  packageName: string
  effectiveAt: Date
}

export function PendingDowngradeNotice({ packageName, effectiveAt }: PendingDowngradeNoticeProps) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelScheduledDowngradeAction()
      if (result.ok) {
        toast.success("Scheduled change cancelled.")
        router.refresh()
      } else {
        toast.error(result.error ?? "Could not cancel the scheduled change.")
      }
    })
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
      <span className="flex items-center gap-2">
        <Clock className="size-4 shrink-0" />
        Switching to {packageName} on {effectiveAt.toLocaleDateString()}.
      </span>
      <Button variant="outline" size="sm" disabled={pending} onClick={handleCancel} className="shrink-0">
        {pending ? "Cancelling…" : "Cancel change"}
      </Button>
    </div>
  )
}
