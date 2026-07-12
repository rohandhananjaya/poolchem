"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  MapPin,
  Pencil,
  Play,
  User,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { CardRow } from "@/components/ui/card-row"
import { HealthBadge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CancelVisitDialog } from "@/components/visits/CancelVisitDialog"
import {
  cancelVisitAction,
  updateVisitAction,
} from "@/app/(dashboard)/schedule/actions"
import { startVisitAction } from "@/app/(dashboard)/visits/[visitId]/actions"

export interface VisitCardVisit {
  id: string
  poolName: string
  address: string | null
  status: string
  scheduledAt?: string | null
  timeLabel?: string | null
  health: { score: number; status: string } | null
  assignedTech?: { id: string; name: string } | null
  techId?: string | null
}

export interface VisitCardProps {
  visit: VisitCardVisit
  /** Override the time label shown; falls back to `visit.timeLabel`. */
  timeLabel?: string
  currentUserId: string
  userRole?: string
  techs?: Array<{ id: string; name: string; email: string }>
}

export function VisitCard({ visit, timeLabel, currentUserId, userRole, techs }: VisitCardProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [cancelling, setCancelling] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const dateInputRef = React.useRef<HTMLInputElement>(null)
  const [selectedTechId, setSelectedTechId] = React.useState<string>(
    visit.assignedTech?.id ?? visit.techId ?? "",
  )

  const completed = visit.status === "COMPLETED"
  const isCancelled = visit.status === "CANCELLED"
  const isDraft = visit.status === "DRAFT"
  const inProgress = visit.status === "IN_PROGRESS"
  const assignedTechId = visit.assignedTech?.id ?? visit.techId
  const isOthersVisit = inProgress && !!assignedTechId && assignedTechId !== currentUserId
  const isOwner = userRole === "OWNER" || userRole === "SUPER_ADMIN"
  const canEdit = (isDraft || inProgress) && isOwner && !isOthersVisit

  const displayTime = timeLabel ?? visit.timeLabel ?? "Unscheduled"

  /** Reset edit state to the visit's current values. */
  function resetEdit() {
    setSelectedTechId(visit.assignedTech?.id ?? visit.techId ?? "")
    setEditing(false)
  }

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

  async function handleCancel(reason: string) {
    const formData = new FormData()
    formData.set("visitId", visit.id)
    formData.set("reason", reason)

    const result = await cancelVisitAction({ ok: false }, formData)
    if (result.ok) {
      toast.success("Visit cancelled.")
      setOpen(false)
      setCancelling(false)
      router.refresh()
    } else if (result.error) {
      toast.error(result.error)
    }
  }

  async function handleUpdateSchedule(formData: FormData) {
    formData.set("visitId", visit.id)
    // Only include techId for owners
    if (isOwner && selectedTechId) {
      formData.set("techId", selectedTechId)
    }

    startTransition(async () => {
      const result = await updateVisitAction({ ok: false }, formData)
      if (result.ok) {
        toast.success("Schedule updated.")
        setEditing(false)
        setOpen(false)
        router.refresh()
      } else if (result.error) {
        toast.error(result.error)
      }
    })
  }

  function resetDialog() {
    setCancelling(false)
    resetEdit()
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
            ) : isOthersVisit ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 dark:text-sky-400">
                <Play className="size-4" />
                In Progress
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
          <HealthBadge score={visit.health?.score ?? null} />
        </div>

        {visit.address ? (
          <p className="mt-1 flex items-center gap-1.5 text-base font-medium text-muted-foreground">
            <MapPin className="size-4 shrink-0" />
            <span className="truncate">{visit.address}</span>
          </p>
        ) : null}

        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5 shrink-0" />
          {displayTime}
        </p>

        {visit.assignedTech ? (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="size-3.5 shrink-0" />
            {visit.assignedTech.name}
          </p>
        ) : visit.techId === null && visit.assignedTech !== undefined ? (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs italic text-muted-foreground">
            <User className="size-3.5 shrink-0" />
            Unassigned — anyone can take
          </p>
        ) : null}
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
            <CancelVisitDialog
              onCancel={handleCancel}
              onBack={() => setCancelling(false)}
            />
          ) : editing ? (
            <form action={handleUpdateSchedule} className="space-y-4">
              <div className="grid gap-1.5">
                <label htmlFor="edit-date" className="text-sm font-medium">
                  Date
                </label>
                <input
                  ref={dateInputRef}
                  id="edit-date"
                  name="date"
                  type="date"
                  defaultValue={
                    visit.scheduledAt
                      ? visit.scheduledAt.split("T")[0]
                      : ""
                  }
                  className="flex h-9 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                />
              </div>

              {isOwner && techs ? (
                <div className="grid gap-1.5">
                  <label htmlFor="edit-tech" className="text-sm font-medium">
                    Assign to
                  </label>
                  <select
                    id="edit-tech"
                    name="techId"
                    value={selectedTechId}
                    onChange={(e) => setSelectedTechId(e.target.value)}
                    className="flex h-9 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  >
                    <option value="">Anyone can take</option>
                    {techs.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetEdit}
                >
                  Cancel
                </Button>
                <Button type="submit" size="lg" disabled={pending}>
                  {pending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <HealthBadge score={visit.health?.score ?? null} />
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
                ) : isOthersVisit ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 dark:text-sky-400">
                    <Play className="size-4" />
                    In Progress
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
                {displayTime}
              </p>

              {visit.assignedTech ? (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <User className="size-3.5 shrink-0" />
                  {visit.assignedTech.name}
                </p>
              ) : visit.assignedTech !== undefined ? (
                <p className="flex items-center gap-1.5 text-sm italic text-muted-foreground">
                  <User className="size-3.5 shrink-0" />
                  Unassigned
                </p>
              ) : null}

              {!isOthersVisit && (isDraft || inProgress) ? (
                <DialogFooter className="gap-2 sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setCancelling(true)}
                    >
                      <XCircle className="size-4" />
                      Cancel Visit
                    </Button>
                    {canEdit && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditing(true)
                        }}
                      >
                        <Pencil className="size-4" />
                        Edit Schedule
                      </Button>
                    )}
                  </div>
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
