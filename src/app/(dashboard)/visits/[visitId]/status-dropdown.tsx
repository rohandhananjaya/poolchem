"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cancelVisitAction, updateVisitStatusAction } from "./actions"

interface StatusDropdownProps {
  visitId: string
  currentStatus: "DRAFT" | "IN_PROGRESS" | "CANCELLED"
}

const OPTIONS: Array<{
  value: "DRAFT" | "IN_PROGRESS" | "CANCELLED"
  label: string
}> = [
  { value: "DRAFT", label: "Scheduled" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "CANCELLED", label: "Cancelled" },
]

export function StatusDropdown({
  visitId,
  currentStatus,
}: StatusDropdownProps) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false)
  const [cancelReason, setCancelReason] = React.useState("")
  const [isCustom, setIsCustom] = React.useState(false)

  function handleChange(status: "DRAFT" | "IN_PROGRESS") {
    if (status === currentStatus) return
    startTransition(async () => {
      try {
        await updateVisitStatusAction(visitId, status)
        toast.success("Visit status updated.")
        router.refresh()
      } catch {
        toast.error("Could not update status.")
      }
    })
  }

  function handleCancel() {
    if (!cancelReason.trim()) return
    startTransition(async () => {
      try {
        await cancelVisitAction(visitId, cancelReason.trim())
        toast.success("Visit cancelled.")
        setCancelDialogOpen(false)
        setCancelReason("")
        setIsCustom(false)
        router.refresh()
      } catch {
        toast.error("Could not cancel visit.")
      }
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="xs"
            disabled={pending}
            className="size-6 p-0"
          >
            <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              disabled={opt.value === currentStatus || pending}
              onSelect={() => {
                if (opt.value === "CANCELLED") {
                  setCancelDialogOpen(true)
                } else {
                  handleChange(opt.value)
                }
              }}
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Visit</DialogTitle>
            <DialogDescription>
              Provide a reason for cancelling this visit.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <label
              htmlFor="cancel-reason-select"
              className="text-sm font-medium text-foreground"
            >
              Reason for cancellation
            </label>
            <select
              id="cancel-reason-select"
              value={isCustom ? "__custom__" : cancelReason}
              onChange={(e) => {
                const val = e.target.value
                if (val === "__custom__") {
                  setIsCustom(true)
                  setCancelReason("")
                } else {
                  setIsCustom(false)
                  setCancelReason(val)
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
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Type a reason…"
                autoFocus
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground dark:bg-input/30"
              />
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelDialogOpen(false)
                setCancelReason("")
                setIsCustom(false)
              }}
            >
              Back
            </Button>
            <Button
              onClick={handleCancel}
              disabled={!cancelReason.trim() || pending}
            >
              {pending ? "Cancelling..." : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
