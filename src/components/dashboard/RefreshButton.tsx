"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * Re-runs the dashboard's Server Component data fetch. A lightweight stand-in
 * for pull-to-refresh on desktop and mobile alike.
 */
export function RefreshButton() {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  return (
    <Button
      variant="outline"
      size="icon-lg"
      aria-label="Refresh visits"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw className={cn(pending && "animate-spin")} />
    </Button>
  )
}
