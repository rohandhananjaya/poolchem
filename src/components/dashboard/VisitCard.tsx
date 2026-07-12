"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  MapPin,
  Play,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { CardRow } from "@/components/ui/card-row"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  cancelVisitAction,
  type ScheduleFormState,
} from "@/app/(dashboard)/schedule/actions"
import { startVisitAction } from "@/app/(dashboard)/visits/[visitId]/actions"
import type { DashboardVisit } from "@/lib/db/dashboard"

const INITIAL_STATE: ScheduleFormState = { ok: false }

/** Maps a 0–100 water-health score to a traffic-light badge tone. */
function healthClasses(score: number): string {
  if (score >= 75) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
  }
  if (score >= 50) {
    return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
  }
  return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
}

function HealthBadge({ health }: { health: DashboardVisit["health"] }) {
  if (!health) {
    return (
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        No reading
      </span>
    )
  }

  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
        healthClasses(health.score),
      )}
      title={`Water health: ${health.status.toLowerCase()}`}
    >
      {health.score}
    </span>
  )
}

export interface VisitCardProps {
  visit: DashboardVisit
}

/**
 * A single service visit on today's route: client name + address, its time
 * slot, a colored water-health badge, and either a "Start Visit" action or a
 * completed marker.
 */
export function VisitCard({ visit }: VisitCardProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [cancelling, setCancelling] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [isCustom, setIsCustom] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const completed = visit.status === "COMPLETED"
  const isCancelled = visit.status === "CANCELLED"
  const isDraft = visit.status === "DRAFT"
  const inProgress = visit.status === "IN_PROGRESS"

  const trimmedReason = reason.trim()
  const canCancel = trimmedReason.length > 0

  function handleStartVisit() {
    startTransition(async () => {
      try {
        await startVisitAction(visit.id)
        router.push(`/visits/${visit.id}`)
      } catch {
        toast.error("Could not start visit.")
      }
    })
  }

  function handleCancel() {
    if (!canCancel) return

    const formData = new FormData()
    formData.set("visitId", visit.id)
    formData.set("reason", trimmedReason)

    startTransition(async () => {
      const result = await cancelVisitAction(INITIAL_STATE, formData)
      if (result.ok) {
        toast.success("Visit cancelled.")
        setOpen(false)
        setCancelling(false)
        setReason("")
        router.refresh()
      } else if (result.error) {
        toast.error(result.error)
      }
    })
  }

  function resetDialog() {
    setCancelling(false)
    setReason("")
    setIsCustom(false)
  }

  return (
    <>
      <CardRow
        hover
        onClick={() => setOpen(true)}
        className="cursor-pointer"
        actions={
          <div className="flex items-center gap-2">
            {completed ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                Completed
              </span>
            ) : isCancelled ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <XCircle className="size-4" />
                Cancelled
              </span>
            ) : inProgress ? (
              <Button
                size="lg"
                onClick={(e) => {
                  e.stopPropagation()
                  router.push(`/visits/${visit.id}`)
                }}
              >
                <Play className="size-4" />
                Continue
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={(e) => {
                  e.stopPropagation()
                  handleStartVisit()
                }}
                disabled={pending}
              >
                {pending ? "Starting…" : "Start Visit"}
              </Button>
            )}
          </div>
        }
      >
        <div className="flex items-center gap-2">
          <h3 className="truncate text-lg font-semibold text-card-foreground">
            {visit.poolName}
          </h3>
          <HealthBadge health={visit.health} />
        </div>

        {visit.address ? (
          <p className="mt-1 flex items-center gap-1.5 text-base font-medium text-muted-foreground">
            <MapPin className="size-4 shrink-0" />
            <span className="truncate">{visit.address}</span>
          </p>
        ) : null}

        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5 shrink-0" />
          {visit.timeLabel ?? "Unscheduled"}
        </p>
      </CardRow>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) resetDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{visit.poolName}</DialogTitle>
            <DialogDescription>Visit details and actions</DialogDescription>
          </DialogHeader>

          {cancelling ? (
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
                  onClick={() => setCancelling(false)}
                  disabled={pending}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!canCancel || pending}
                  onClick={handleCancel}
                >
                  {pending ? "Cancelling…" : "Confirm Cancel"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <HealthBadge health={visit.health} />
                {completed ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-4" />
                    Completed
                  </span>
                ) : isCancelled ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <XCircle className="size-4" />
                    Cancelled
                  </span>
                ) : inProgress ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 dark:text-sky-400">
                    <Play className="size-4" />
                    In Progress
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
                    <CalendarClock className="size-4" />
                    Scheduled
                  </span>
                )}
              </div>

              {visit.address ? (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0" />
                  {visit.address}
                </p>
              ) : null}

              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="size-3.5 shrink-0" />
                {visit.timeLabel ?? "Unscheduled"}
              </p>

              {isDraft || inProgress ? (
                <DialogFooter className="gap-2 sm:justify-between">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setCancelling(true)}
                  >
                    <XCircle className="size-4" />
                    Cancel Visit
                  </Button>
                  {inProgress ? (
                    <Button
                      variant="default"
                      onClick={() => {
                        setOpen(false)
                        router.push(`/visits/${visit.id}`)
                      }}
                    >
                      <Play className="size-4" />
                      Continue
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      onClick={() => {
                        setOpen(false)
                        handleStartVisit()
                      }}
                      disabled={pending}
                    >
                      {pending ? "Starting…" : "Start Visit"}
                    </Button>
                  )}
                </DialogFooter>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
