import { Mic } from "lucide-react"

import { cn } from "@/lib/utils"

export interface VisitNotesProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function VisitNotes({
  value,
  onChange,
  disabled = false,
}: VisitNotesProps) {
  return (
    <div className="space-y-2">
      <label
        htmlFor="visit-notes"
        className="text-sm font-medium text-foreground"
      >
        Technician Notes
      </label>

      <div className="relative">
        <textarea
          id="visit-notes"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Add notes about this visit..."
          className={cn(
            "flex min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none",
            "placeholder:text-muted-foreground",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            "dark:bg-input/30",
            "resize-y",
          )}
        />

        <button
          type="button"
          disabled
          className="absolute bottom-2 right-2 inline-flex size-8 items-center justify-center rounded-lg opacity-30"
          title="Voice recording (coming soon)"
        >
          <Mic className="size-4" />
        </button>
      </div>

      {value && (
        <p className="text-xs text-muted-foreground">{value.length} characters</p>
      )}
    </div>
  )
}
