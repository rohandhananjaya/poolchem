import { Camera } from "lucide-react"
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
import { Button } from "@/components/ui/button"

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

  let isOutOfRange = false
  try {
    const range = getIdealRange(label)
    if (hasValue) {
      isOutOfRange = value! < range.min || value! > range.max
    }
  } catch {}

  const showUseLast =
    lastReading !== null &&
    lastReading !== undefined &&
    !hasValue &&
    !disabled

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={name} className="text-sm font-medium">
          {label}
        </Label>
        {showUseLast && (
          <button
            type="button"
            onClick={() => field.onChange(lastReading)}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Use Last:{" "}
            <span className="font-mono tabular-nums">{lastReading}</span>
          </button>
        )}
      </div>

      <div className="relative">
        <Input
          id={name}
          type="number"
          inputMode="decimal"
          step="any"
          className={cn(
            // Large, monospace, tabular so digits align and are easy to tap
            // precisely with gloves/wet hands in the field. h-12 = comfy target.
            "h-12 pr-20 font-mono text-lg leading-[1.4] tabular-nums",
            isOutOfRange &&
              "border-amber-400 ring-2 ring-amber-400/30 focus-visible:border-amber-500 focus-visible:ring-amber-500/40",
            error && "border-destructive",
          )}
          placeholder={
            lastReading != null ? `Last: ${lastReading}` : undefined
          }
          disabled={disabled}
          {...field}
          value={value ?? ""}
          onChange={(e) => {
            const val = e.target.value
            field.onChange(val === "" ? undefined : Number(val))
          }}
        />

        {unit && (
          <span className="pointer-events-none absolute right-11 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {unit}
          </span>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled
          className="absolute right-0 top-0 size-12 rounded-lg opacity-30"
          title="Scan test strip (coming soon)"
        >
          <Camera className="size-4" />
        </Button>
      </div>

      {error && (
        <p className="text-xs text-destructive">{error.message}</p>
      )}
    </div>
  )
}
