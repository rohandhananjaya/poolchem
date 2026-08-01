"use client"

import * as React from "react"
import { Bug, CheckCircle2, Lightbulb, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { FeedbackType } from "@/generated/prisma/client"
import {
  submitFeedbackAction,
  type FormState,
} from "@/app/(dashboard)/feedback/actions"

const INITIAL_STATE: FormState = { ok: false }

interface TypeOption {
  value: FeedbackType
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  activeClass: string
}

const TYPE_OPTIONS: TypeOption[] = [
  {
    value: "BUG_REPORT",
    label: "Bug report",
    description: "Something isn't working",
    icon: Bug,
    activeClass:
      "border-red-500 bg-red-50 dark:bg-red-950/30 aria-checked:border-red-500",
  },
  {
    value: "FEATURE_REQUEST",
    label: "Feature request",
    description: "A new idea or capability",
    icon: Lightbulb,
    activeClass:
      "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 aria-checked:border-emerald-500",
  },
  {
    value: "ISSUE",
    label: "General issue",
    description: "A problem or a question",
    icon: TriangleAlert,
    activeClass:
      "border-amber-500 bg-amber-50 dark:bg-amber-950/30 aria-checked:border-amber-500",
  },
]

export function FeedbackForm() {
  const [state, action, pending] = React.useActionState(
    submitFeedbackAction,
    INITIAL_STATE,
  )
  const formRef = React.useRef<HTMLFormElement>(null)

  // Clear the fields once a submission lands, so the form is ready for the next.
  React.useEffect(() => {
    if (state.ok) formRef.current?.reset()
  }, [state])

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-card-foreground">
          Report a problem or suggest an idea
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Tell the Poolbench team what you found — your report is sent to the
          platform administrators.
        </p>
      </header>

      {state.ok ? (
        <div
          role="status"
          className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>
            Thanks — we&apos;ve received your report. Track its status under
            Your submissions below.
          </span>
        </div>
      ) : null}

      <form ref={formRef} action={action} className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-foreground">
            What&apos;s this about?
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {TYPE_OPTIONS.map((option) => {
              const Icon = option.icon
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-background p-3 transition-colors hover:bg-muted/50",
                    "has-checked:bg-muted/50 aria-checked:border-border",
                    option.activeClass,
                  )}
                >
                  <input
                    type="radio"
                    name="type"
                    value={option.value}
                    defaultChecked={option.value === "BUG_REPORT"}
                    className="peer sr-only"
                  />
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {option.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="grid gap-1.5">
          <Label htmlFor="feedback-title">Title</Label>
          <Input
            id="feedback-title"
            name="title"
            placeholder="Short summary, e.g. &quot;App crashes when I scan a pool&quot;"
            maxLength={120}
            required
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="feedback-description">Details</Label>
          <textarea
            id="feedback-description"
            name="description"
            rows={5}
            maxLength={4000}
            placeholder="What did you expect to happen, and what actually happened?"
            required
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>

        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Submitting…" : "Submit report"}
        </Button>
      </form>
    </section>
  )
}
