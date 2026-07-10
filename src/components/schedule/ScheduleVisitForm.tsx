"use client"

import * as React from "react"
import { CalendarPlus, X } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { scheduleVisitAction } from "@/app/(dashboard)/schedule/actions"

export interface ScheduleVisitFormProps {
  /** Active pools to choose from, ordered by name. */
  pools: Array<{ id: string; name: string }>
}

/**
 * A collapsible "Schedule a visit" form: pick a pool and a date, submit to the
 * `scheduleVisitAction` server action. Uses native controls styled to match the
 * app's inputs (there is no Select/Dialog primitive in this project).
 */
export function ScheduleVisitForm({ pools }: ScheduleVisitFormProps) {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const formRef = React.useRef<HTMLFormElement>(null)

  // A server action invoked directly so success side-effects (toast, reset,
  // collapse) run in the event handler rather than a render effect.
  async function handleSubmit(formData: FormData) {
    setPending(true)
    const result = await scheduleVisitAction({ ok: false }, formData)
    setPending(false)
    if (result.ok) {
      toast.success("Visit scheduled.")
      formRef.current?.reset()
      setOpen(false)
    } else if (result.error) {
      toast.error(result.error)
    }
  }

  if (pools.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground">
        Add a pool before scheduling a visit.
      </p>
    )
  }

  if (!open) {
    return (
      <Button type="button" size="lg" onClick={() => setOpen(true)}>
        <CalendarPlus />
        Schedule a visit
      </Button>
    )
  }

  const inputClasses = cn(
    "flex h-9 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none",
    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
    "dark:bg-input/30",
  )

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="rounded-xl border border-border bg-card p-4 md:p-6"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-card-foreground">
          Schedule a visit
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Cancel"
          onClick={() => setOpen(false)}
        >
          <X />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="schedule-pool">Pool</Label>
          <select
            id="schedule-pool"
            name="poolId"
            required
            defaultValue=""
            className={inputClasses}
          >
            <option value="" disabled>
              Select a pool…
            </option>
            {pools.map((pool) => (
              <option key={pool.id} value={pool.id}>
                {pool.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="schedule-date">Date</Label>
          <input
            id="schedule-date"
            name="date"
            type="date"
            required
            className={inputClasses}
          />
        </div>
      </div>

      <div className="mt-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Scheduling…" : "Schedule visit"}
        </Button>
      </div>
    </form>
  )
}
