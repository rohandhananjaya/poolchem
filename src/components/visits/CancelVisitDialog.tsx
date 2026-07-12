"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { DialogFooter } from "@/components/ui/dialog"

export interface CancelVisitDialogProps {
  onCancel: (reason: string) => Promise<void>
  onBack: () => void
}

/**
 * Renders the cancel-visit confirmation UI inside a dialog: a reason select
 * with 6 predefined options plus an "Other…" custom text input, and Back /
 * Confirm Cancel buttons. Manages its own pending/reason/isCustom state.
 */
export function CancelVisitDialog({ onCancel, onBack }: CancelVisitDialogProps) {
  const [reason, setReason] = React.useState("")
  const [isCustom, setIsCustom] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const trimmedReason = reason.trim()
  const canCancel = trimmedReason.length > 0

  function handleConfirm() {
    if (!canCancel) return
    startTransition(async () => {
      await onCancel(trimmedReason)
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Are you sure you want to cancel this visit? A reason is required.
      </p>

      <div className="grid gap-1.5">
        <label
          htmlFor="cancel-reason-select"
          className="text-sm font-medium text-foreground"
        >
          Reason for cancellation
        </label>
        <select
          id="cancel-reason-select"
          value={isCustom ? "__custom__" : reason}
          onChange={(e) => {
            const val = e.target.value
            if (val === "__custom__") {
              setIsCustom(true)
              setReason("")
            } else {
              setIsCustom(false)
              setReason(val)
            }
          }}
          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="" disabled>
            Select a reason…
          </option>
          <option value="Customer rescheduled">Customer rescheduled</option>
          <option value="Pool closed / winterized">Pool closed / winterized</option>
          <option value="Customer not home">Customer not home</option>
          <option value="Weather conditions">Weather conditions</option>
          <option value="Duplicate visit">Duplicate visit</option>
          <option value="Access issue (gate/lock)">Access issue (gate/lock)</option>
          <option value="__custom__">Other…</option>
        </select>
        {isCustom ? (
          <input
            id="cancel-reason-custom"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Type a reason…"
            autoFocus
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground dark:bg-input/30"
          />
        ) : null}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={pending}
        >
          Back
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={!canCancel || pending}
          onClick={handleConfirm}
        >
          {pending ? "Cancelling…" : "Confirm Cancel"}
        </Button>
      </DialogFooter>
    </div>
  )
}
