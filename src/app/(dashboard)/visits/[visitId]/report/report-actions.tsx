"use client"

import { useCallback, useState } from "react"
import { Check, Copy, Mail, Printer, X, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { sendReportEmailAction } from "./actions"

export interface ReportActionsProps {
  homeownerEmail: string | null
  poolName: string
  reportUrl: string
  visitId: string
}

export function ReportActions({
  homeownerEmail,
  poolName,
  reportUrl,
  visitId,
}: ReportActionsProps) {
  const [copied, setCopied] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [recipient, setRecipient] = useState(homeownerEmail ?? "")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(reportUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt("Copy this report link:", reportUrl)
    }
  }, [reportUrl])

  const handleSendEmail = useCallback(async () => {
    if (!recipient.trim()) return
    setSending(true)
    setError(null)
    const result = await sendReportEmailAction(visitId, recipient.trim())
    if (result.ok) {
      setSent(true)
      setSending(false)
      window.setTimeout(() => {
        setEmailOpen(false)
        setSent(false)
        setRecipient(homeownerEmail ?? "")
      }, 2000)
    } else {
      setError(result.error ?? "Failed to send email.")
      setSending(false)
    }
  }, [recipient, visitId, homeownerEmail])

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

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="lg">
            <Mail />
            Email
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Service Report</DialogTitle>
            <DialogDescription>
              Send the report for {poolName} to a homeowner or stakeholder.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="recipient">Recipient email</Label>
              <Input
                id="recipient"
                type="email"
                placeholder="homeowner@example.com"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                required
              />
            </div>
            {sent && (
              <p className="text-sm text-emerald-600">Email sent successfully!</p>
            )}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEmailOpen(false)}
              disabled={sending}
            >
              <X />
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSendEmail}
              disabled={sending || !recipient.trim()}
            >
              {sending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Sending…
                </>
              ) : (
                <Mail />
              )}
              {sending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
