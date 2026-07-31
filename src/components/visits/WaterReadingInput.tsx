import {
  useController,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form"

import { cn } from "@/lib/utils"
import { getIdealRange } from "@/lib/pool-chemistry"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface WaterReadingInputProps<T extends FieldValues> {
  name: Path<T>
  label: string
  unit: string
  control: Control<T>
  disabled?: boolean
  lastReading?: number | null
}

export function WaterReadingInput<T extends FieldValues>({
  name,
  label,
  unit,
  control,
  disabled = false,
  lastReading,
}: WaterReadingInputProps<T>) {
  const {
    field,
    fieldState: { error },
  } = useController({ name, control })

  const value = field.value as number | undefined
  const hasValue = value !== undefined && value !== null

  let idealRange: { min: number; max: number; unit: string } | null = null
  let isInRange = false
  let isOutOfRange = false
  try {
    idealRange = getIdealRange(label)
    if (hasValue) {
      isInRange = value! >= idealRange.min && value! <= idealRange.max
      isOutOfRange = value! < idealRange.min || value! > idealRange.max
    }
  } catch {}

  const showLastReading =
    lastReading !== null &&
    lastReading !== undefined &&
    !hasValue &&
    !disabled

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Label htmlFor={name} className="text-sm font-medium">
            {label}
          </Label>
          {hasValue && idealRange && (
            <span
              className={cn(
                "inline-block size-2 shrink-0 rounded-full",
                isInRange && "bg-emerald-500",
                isOutOfRange && "bg-amber-500",
              )}
              aria-label={isInRange ? "In ideal range" : "Out of ideal range"}
            />
          )}
          {!hasValue && idealRange && (
            <span
              className="inline-block size-2 shrink-0 rounded-full bg-muted-foreground/30"
              aria-label="No reading entered"
            />
          )}
        </div>
        {idealRange && (
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {idealRange.min}–{idealRange.max}
          </span>
        )}
      </div>

      <div className="relative">
        <Input
          id={name}
          type="number"
          inputMode="decimal"
          step="any"
          className={cn(
            "h-12 pr-11 font-mono text-lg leading-[1.4] tabular-nums",
            isOutOfRange &&
              "border-amber-400 ring-2 ring-amber-400/30 focus-visible:border-amber-500 focus-visible:ring-amber-500/40",
            error && "border-destructive",
          )}
          disabled={disabled}
          {...field}
          value={value ?? ""}
          onChange={(e) => {
            const val = e.target.value
            field.onChange(val === "" ? undefined : Number(val))
          }}
        />

        {unit && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {unit}
          </span>
        )}
      </div>

      {showLastReading && (
        <span className="text-xs text-muted-foreground">
          Last read : <span className="font-mono tabular-nums">{lastReading}</span>
        </span>
      )}

      {error && (
        <p className="text-xs text-destructive">{error.message}</p>
      )}
    </div>
  )
}
