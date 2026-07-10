"use client"

import { useState, useMemo, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { Loader2, AlertTriangle } from "lucide-react"
import type { Resolver } from "react-hook-form"
import { toast } from "sonner"

import { ERROR_MESSAGES } from "@/lib/errors"

import {
  getWaterHealthScore,
  calculateLSI,
  getChemicalRecommendations,
  type WaterReadingInput as WaterReading,
  type ChemicalRecommendation,
} from "@/lib/pool-chemistry"
import { Button } from "@/components/ui/button"
import { WaterReadingInput } from "@/components/visits/WaterReadingInput"
import { WaterHealthGauge } from "@/components/visits/WaterHealthGauge"
import { ChemicalRecommendations } from "@/components/visits/ChemicalRecommendations"
import { VisitNotes } from "@/components/visits/VisitNotes"
import {
  saveDraftAction,
  completeVisitAction,
  type VisitFormValues,
} from "./actions"
import type { VisitReadings } from "@/lib/db/visits"

const readingsSchema = z.object({
  ph: z.number().min(0).max(14).optional(),
  freeChlorine: z.number().min(0).max(20).optional(),
  totalAlkalinity: z.number().min(0).max(500).optional(),
  calciumHardness: z.number().min(0).max(1000).optional(),
  cyanuricAcid: z.number().min(0).max(300).optional(),
  temperature: z.number().min(32).max(110).optional(),
})

const formSchema = z.object({
  readings: readingsSchema,
  notes: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface SerializedVisit {
  id: string
  status: string
  notes: string | null
  pool: {
    name: string
    address: string | null
    image: string | null
    volume: number
  }
  waterReadings: Array<{
    ph: number
    freeChlorine: number
    totalAlkalinity: number
    calciumHardness: number
    cyanuricAcid: number
    temperature: number
  }>
  chemicalsAdded: Array<{
    name: string
    amount: number
    unit: string
  }>
}

interface VisitFormProps {
  visit: SerializedVisit
  lastReadings: VisitReadings | null
  currentUser: { id: string; name: string }
}

export function VisitForm({
  visit,
  lastReadings,
  currentUser,
}: VisitFormProps) {
  const completed = visit.status === "COMPLETED"
  const existingReading = visit.waterReadings[0] ?? null

  const defaultReadings = existingReading
    ? {
        ph: existingReading.ph,
        freeChlorine: existingReading.freeChlorine,
        totalAlkalinity: existingReading.totalAlkalinity,
        calciumHardness: existingReading.calciumHardness,
        cyanuricAcid: existingReading.cyanuricAcid,
        temperature: existingReading.temperature,
      }
    : {
        ph: undefined,
        freeChlorine: undefined,
        totalAlkalinity: undefined,
        calciumHardness: undefined,
        cyanuricAcid: undefined,
        temperature: undefined,
      }

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      readings: defaultReadings as FormData["readings"],
      notes: visit.notes ?? "",
    },
    disabled: completed,
  })

  // react-hook-form mutates the nested `readings` object in place, so
  // `watch("readings")` returns a referentially-stable object across renders.
  // Rebuild a fresh reference whenever an individual reading changes, otherwise
  // the derived useMemos below (keyed on `readings`) never recompute and the
  // analysis + recommendations stay frozen at their initial empty state.
  const readingsValue = watch("readings")
  const readings = useMemo(
    () => ({ ...readingsValue }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      readingsValue.ph,
      readingsValue.freeChlorine,
      readingsValue.totalAlkalinity,
      readingsValue.calciumHardness,
      readingsValue.cyanuricAcid,
      readingsValue.temperature,
    ],
  )
  const notes = watch("notes")

  const initialChemicals: Record<string, boolean> = {}
  if (completed) {
    for (const c of visit.chemicalsAdded) {
      initialChemicals[c.name] = true
    }
  }

  const [checkedChemicals, setCheckedChemicals] =
    useState<Record<string, boolean>>(initialChemicals)

  const handleToggleChemical = useCallback((chemical: string) => {
    setCheckedChemicals((prev) => ({
      ...prev,
      [chemical]: !prev[chemical],
    }))
  }, [])

  const allFieldsFilled = useMemo(() => {
    const r = readings
    return (
      r.ph !== undefined &&
      r.ph !== null &&
      r.freeChlorine !== undefined &&
      r.freeChlorine !== null &&
      r.totalAlkalinity !== undefined &&
      r.totalAlkalinity !== null &&
      r.calciumHardness !== undefined &&
      r.calciumHardness !== null &&
      r.cyanuricAcid !== undefined &&
      r.cyanuricAcid !== null &&
      r.temperature !== undefined &&
      r.temperature !== null
    )
  }, [readings])

  const waterHealth = useMemo(() => {
    if (!allFieldsFilled) return null
    return getWaterHealthScore(readings as unknown as WaterReading)
  }, [readings, allFieldsFilled])

  const lsi = useMemo(() => {
    if (!allFieldsFilled) return null
    const r = readings as unknown as WaterReading
    if (!r.temperature) return null
    return calculateLSI(
      r.ph,
      r.temperature,
      r.calciumHardness,
      r.totalAlkalinity,
    )
  }, [readings, allFieldsFilled])

  const recommendations: ChemicalRecommendation[] = useMemo(() => {
    if (!allFieldsFilled) return []
    return getChemicalRecommendations(
      readings as unknown as WaterReading,
      visit.pool.volume,
    )
  }, [readings, allFieldsFilled, visit.pool.volume])

  const buildPayload = useCallback(
    (data: FormData): VisitFormValues => ({
      readings: {
        ph: data.readings.ph ?? 0,
        freeChlorine: data.readings.freeChlorine ?? 0,
        totalAlkalinity: data.readings.totalAlkalinity ?? 0,
        calciumHardness: data.readings.calciumHardness ?? 0,
        cyanuricAcid: data.readings.cyanuricAcid ?? 0,
        temperature: data.readings.temperature ?? 0,
      },
      chemicals: Object.entries(checkedChemicals)
        .filter(([, checked]) => checked)
        .map(([name]) => {
          const rec = recommendations.find((r) => r.chemical === name)
          return {
            name,
            amount: rec?.amount ?? 0,
            unit: rec?.unit ?? "",
          }
        }),
      notes: data.notes ?? "",
    }),
    [checkedChemicals, recommendations],
  )

  const [saving, setSaving] = useState<"draft" | "complete" | null>(null)

  const handleSaveDraft = useCallback(async () => {
    setSaving("draft")
    let saved = false
    try {
      await handleSubmit(async (data) => {
        await saveDraftAction(visit.id, buildPayload(data))
        saved = true
      })()
      if (saved) toast.info("Visit saved as draft")
    } catch {
      toast.error(ERROR_MESSAGES.SAVE_FAILED)
    } finally {
      setSaving(null)
    }
  }, [handleSubmit, buildPayload, visit.id])

  const handleComplete = useCallback(async () => {
    setSaving("complete")
    let didComplete = false
    try {
      await handleSubmit(async (data) => {
        await completeVisitAction(visit.id, buildPayload(data))
        didComplete = true
      })()
      // completeVisitAction redirects to the (now completed) visit; the root
      // Toaster survives that navigation so the success toast still shows.
      if (didComplete) toast.success("Report sent successfully")
    } catch {
      toast.error(ERROR_MESSAGES.SAVE_FAILED)
    } finally {
      setSaving(null)
    }
  }, [handleSubmit, buildPayload, visit.id])

  return (
    <form className="mt-6 space-y-6">
      {/* Water Test Input Card */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-card-foreground">
            Log Readings
          </h2>
          {!completed && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled
              className="opacity-50"
            >
              Scan Test Strip
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <WaterReadingInput
            name="readings.ph"
            label="pH"
            unit=""
            control={control}
            disabled={completed}
            lastReading={
              completed ? null : lastReadings?.ph ?? undefined
            }
          />
          <WaterReadingInput
            name="readings.freeChlorine"
            label="Free Chlorine"
            unit="ppm"
            control={control}
            disabled={completed}
            lastReading={
              completed
                ? null
                : lastReadings?.freeChlorine ?? undefined
            }
          />
          <WaterReadingInput
            name="readings.totalAlkalinity"
            label="Total Alkalinity"
            unit="ppm"
            control={control}
            disabled={completed}
            lastReading={
              completed
                ? null
                : lastReadings?.totalAlkalinity ?? undefined
            }
          />
          <WaterReadingInput
            name="readings.calciumHardness"
            label="Calcium Hardness"
            unit="ppm"
            control={control}
            disabled={completed}
            lastReading={
              completed
                ? null
                : lastReadings?.calciumHardness ?? undefined
            }
          />
          <WaterReadingInput
            name="readings.cyanuricAcid"
            label="Cyanuric Acid"
            unit="ppm"
            control={control}
            disabled={completed}
            lastReading={
              completed
                ? null
                : lastReadings?.cyanuricAcid ?? undefined
            }
          />
          <WaterReadingInput
            name="readings.temperature"
            label="Temperature"
            unit="°F"
            control={control}
            disabled={completed}
            lastReading={
              completed
                ? null
                : lastReadings?.temperature ?? undefined
            }
          />
        </div>
      </div>

      {/* Results Card */}
      {allFieldsFilled && waterHealth && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-4 text-sm font-semibold text-card-foreground">
            Water Analysis
          </h2>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-around">
            <WaterHealthGauge
              score={waterHealth.score}
              status={waterHealth.status}
              lsi={lsi}
            />

            <div className="flex flex-col gap-3 sm:min-w-0 sm:flex-1">
              {waterHealth.issues.length > 0 && (
                <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950/30">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="size-4" />
                    <span>
                      {waterHealth.issues.length} parameter
                      {waterHealth.issues.length > 1 ? "s" : ""} need
                      attention
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {waterHealth.issues.map((issue, i) => (
                      <li
                        key={i}
                        className="text-xs text-amber-700 dark:text-amber-400"
                      >
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {waterHealth.issues.length === 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30">
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    All parameters are within ideal range
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chemical Recommendations Card */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-card-foreground">
          Chemical Recommendations
        </h2>
        <ChemicalRecommendations
          recommendations={recommendations}
          poolVolume={visit.pool.volume}
          checked={checkedChemicals}
          onToggle={handleToggleChemical}
          disabled={completed}
        />
      </div>

      {/* Technician Notes */}
      <div className="rounded-xl border border-border bg-card p-4">
        <VisitNotes
          value={notes ?? ""}
          onChange={(val) => setValue("notes", val)}
          disabled={completed}
        />
      </div>

      {/* Bottom Action Bar */}
      {!completed && (
        <>
          <div className="h-20" />

          <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background p-4">
            <div className="mx-auto flex max-w-5xl items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleSaveDraft}
                disabled={isSubmitting || saving !== null}
              >
                {saving === "draft" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Save Draft
              </Button>

              <Button
                type="button"
                size="lg"
                className="bg-teal-600 text-white hover:bg-teal-700"
                onClick={handleComplete}
                disabled={isSubmitting || saving !== null}
              >
                {saving === "complete" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Complete &amp; Send Report
              </Button>
            </div>
          </div>
        </>
      )}
    </form>
  )
}
