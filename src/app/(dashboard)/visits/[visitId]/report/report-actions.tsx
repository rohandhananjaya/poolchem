"use client"

import { useCallback, useState } from "react"
import { Check, Copy, Mail, Printer } from "lucide-react"

import { Button } from "@/components/ui/button"

export interface ReportActionsProps {
  /** Homeowner-facing address, used to pre-fill the (placeholder) email. */
  homeownerEmail: string
  /** Pool name, used in the email subject. */
  poolName: string
}

/**
 * Client-side actions for the service report: copy a shareable link, open a
 * pre-filled email (placeholder for the future auto-send integration), and
 * print / save-as-PDF via the browser.
 *
 * Hidden when printing (`print:hidden`) so it never appears on paper.
 */
export function ReportActions({ homeownerEmail, poolName }: ReportActionsProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be unavailable (insecure context / denied permission).
      window.prompt("Copy this report link:", window.location.href)
    }
  }, [])

  // Placeholder for the auto-send email integration: opens the user's mail
  // client with a draft. Swap for a server-side transactional send later.
  const handleEmail = useCallback(() => {
    const subject = encodeURIComponent(`Service report — ${poolName}`)
    const body = encodeURIComponent(
      `Hi,\n\nHere is your latest pool service report:\n${window.location.href}\n`,
    )
    window.location.href = `mailto:${homeownerEmail}?subject=${subject}&body=${body}`
  }, [homeownerEmail, poolName])

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button type="button" variant="outline" size="lg" onClick={handleCopyLink}>
        {copied ? (
          <Check className="text-emerald-500" />
        ) : (
          <Copy />
        )}
        {copied ? "Link copied" : "Share Report"}
      </Button>

      <Button type="button" variant="outline" size="lg" onClick={handleEmail}>
        <Mail />
        Email
      </Button>

      <Button
        type="button"
        size="lg"
        className="bg-teal-600 text-white hover:bg-teal-700"
        onClick={() => window.print()}
      >
        <Printer />
        Download PDF
      </Button>
    </div>
  )
}
