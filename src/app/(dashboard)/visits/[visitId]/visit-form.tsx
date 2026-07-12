"use client"

import { useState, useMemo, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { Loader2, AlertTriangle, CheckCircle2, Minus, X } from "lucide-react"
import type { Resolver } from "react-hook-form"
import { toast } from "sonner"

import { ERROR_MESSAGES } from "@/lib/errors"

import {
  getWaterHealthScore,
  calculateLSI,
  getChemicalRecommendations,
  getIdealRange,
  type WaterReadingInput as WaterReading,
  type ChemicalRecommendation,
} from "@/lib/pool-chemistry"
import { Button } from "@/components/ui/button"
import { WaterReadingInput } from "@/components/visits/WaterReadingInput"
import { WaterHealthGauge } from "@/components/visits/WaterHealthGauge"
import { ChemicalRecommendations } from "@/components/visits/ChemicalRecommendations"
import { AddChemicalDialog } from "@/components/visits/AddChemicalDialog"
import { VisitNotes } from "@/components/visits/VisitNotes"
import {
  saveDraftAction,
  completeVisitAction,
  type VisitFormValues,
} from "./actions"
import type { VisitReadings, VisitChemical } from "@/lib/db/visits"

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
  techId: string | null
}

export function VisitForm({
  visit,
  lastReadings,
  currentUser,
  techId,
}: VisitFormProps) {
  const completed = visit.status === "COMPLETED"
  const inProgress = visit.status === "IN_PROGRESS"
  const isOthersVisit = inProgress && !!techId && techId !== currentUser.id
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
    disabled: completed || isOthersVisit,
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

  // Chemicals the tech logged by hand (not from the recommendations list).
  // On a completed visit, seed from any recorded chemical that the engine
  // wouldn't have recommended for the saved reading — those were added manually.
  const [manualChemicals, setManualChemicals] = useState<VisitChemical[]>(
    () => {
      if (!completed || !existingReading) return []
      const recNames = new Set(
        getChemicalRecommendations(
          existingReading as unknown as WaterReading,
          visit.pool.volume,
        ).map((r) => r.chemical),
      )
      return visit.chemicalsAdded.filter((c) => !recNames.has(c.name))
    },
  )

  const handleAddChemical = useCallback((chemical: VisitChemical) => {
    setManualChemicals((prev) => [...prev, chemical])
  }, [])

  const handleRemoveChemical = useCallback((index: number) => {
    setManualChemicals((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const allFieldsFilled = useMemo(() => {
    const r = readings
    return (
      r.ph !== undefined && r.ph !== null &&
      r.freeChlorine !== undefined && r.freeChlorine !== null &&
      r.totalAlkalinity !== undefined && r.totalAlkalinity !== null &&
      r.calciumHardness !== undefined && r.calciumHardness !== null &&
      r.cyanuricAcid !== undefined && r.cyanuricAcid !== null &&
      r.temperature !== undefined && r.temperature !== null
    )
  }, [readings])

  // Water health score works with 5 core params (temperature is optional)
  const hasCoreReadings = useMemo(() => {
    const r = readings
    return (
      r.ph !== undefined && r.ph !== null &&
      r.freeChlorine !== undefined && r.freeChlorine !== null &&
      r.totalAlkalinity !== undefined && r.totalAlkalinity !== null &&
      r.calciumHardness !== undefined && r.calciumHardness !== null &&
      r.cyanuricAcid !== undefined && r.cyanuricAcid !== null
    )
  }, [readings])

  const waterHealth = useMemo(() => {
    if (!hasCoreReadings) return null
    return getWaterHealthScore(readings as unknown as WaterReading)
  }, [readings, hasCoreReadings])

  const lsi = useMemo(() => {
    if (!hasCoreReadings) return null
    const r = readings as unknown as WaterReading
    if (!r.temperature) return null
    return calculateLSI(
      r.ph,
      r.temperature,
      r.calciumHardness,
      r.totalAlkalinity,
    )
  }, [readings, hasCoreReadings])

  const recommendations: ChemicalRecommendation[] = useMemo(() => {
    if (!hasCoreReadings) return []
    return getChemicalRecommendations(
      readings as unknown as WaterReading,
      visit.pool.volume,
    )
  }, [readings, hasCoreReadings, visit.pool.volume])

  const parameterRows = useMemo(() => {
    const configs = [
      { key: "ph" as const, label: "pH", unit: "" },
      { key: "freeChlorine" as const, label: "Free Chlorine", unit: "ppm" },
      { key: "totalAlkalinity" as const, label: "Total Alkalinity", unit: "ppm" },
      { key: "calciumHardness" as const, label: "Calcium Hardness", unit: "ppm" },
      { key: "cyanuricAcid" as const, label: "Cyanuric Acid", unit: "ppm" },
    ]
    const r = readings
    return configs.map(({ key, label, unit }) => {
      const value = r[key]
      if (value === undefined || value === null) {
        return { key, label, unit, value: null, ideal: null, status: "empty" as const }
      }
      try {
        const range = getIdealRange(key)
        const status = value < range.min ? "low" : value > range.max ? "high" : "ideal"
        return { key, label, unit, value, ideal: { min: range.min, max: range.max }, status }
      } catch {
        return { key, label, unit, value, ideal: null, status: "info" as const }
      }
    })
  }, [readings])

  const hasTemp = readings.temperature !== undefined && readings.temperature !== null

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
      chemicals: [
        ...Object.entries(checkedChemicals)
          .filter(([, checked]) => checked)
          .map(([name]) => {
            const rec = recommendations.find((r) => r.chemical === name)
            return {
              name,
              amount: rec?.amount ?? 0,
              unit: rec?.unit ?? "",
            }
          }),
        ...manualChemicals,
      ],
      notes: data.notes ?? "",
    }),
    [checkedChemicals, recommendations, manualChemicals],
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
    if (!allFieldsFilled) {
      toast.error("Please fill in all water readings before completing the report.")
      return
    }
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
  }, [handleSubmit, buildPayload, visit.id, allFieldsFilled])

  return (
    <form className="mt-6 space-y-6">
      {/* Water Test Input Card */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-card-foreground">
            Log Readings
          </h2>
          {!completed && !isOthersVisit && (
            <span className="text-xs text-muted-foreground">
              {[readings.ph, readings.freeChlorine, readings.totalAlkalinity, readings.calciumHardness, readings.cyanuricAcid, readings.temperature]
                .filter((v) => v !== undefined && v !== null).length}/6
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <WaterReadingInput
            name="readings.ph"
            label="pH"
            unit=""
            control={control}
            disabled={completed || isOthersVisit}
            lastReading={
              completed || isOthersVisit ? null : lastReadings?.ph ?? undefined
            }
          />
          <WaterReadingInput
            name="readings.freeChlorine"
            label="Free Chlorine"
            unit="ppm"
            control={control}
            disabled={completed || isOthersVisit}
            lastReading={
              completed || isOthersVisit
                ? null
                : lastReadings?.freeChlorine ?? undefined
            }
          />
          <WaterReadingInput
            name="readings.totalAlkalinity"
            label="Total Alkalinity"
            unit="ppm"
            control={control}
            disabled={completed || isOthersVisit}
            lastReading={
              completed || isOthersVisit
                ? null
                : lastReadings?.totalAlkalinity ?? undefined
            }
          />
          <WaterReadingInput
            name="readings.calciumHardness"
            label="Calcium Hardness"
            unit="ppm"
            control={control}
            disabled={completed || isOthersVisit}
            lastReading={
              completed || isOthersVisit
                ? null
                : lastReadings?.calciumHardness ?? undefined
            }
          />
          <WaterReadingInput
            name="readings.cyanuricAcid"
            label="Cyanuric Acid"
            unit="ppm"
            control={control}
            disabled={completed || isOthersVisit}
            lastReading={
              completed || isOthersVisit
                ? null
                : lastReadings?.cyanuricAcid ?? undefined
            }
          />
          <WaterReadingInput
            name="readings.temperature"
            label="Temperature"
            unit="°F"
            control={control}
            disabled={completed || isOthersVisit}
            lastReading={
              completed || isOthersVisit
                ? null
                : lastReadings?.temperature ?? undefined
            }
          />
        </div>
      </div>

      {/* Results Card — shows when 5 core params are entered */}
      {hasCoreReadings && waterHealth && (
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

          {/* Per-parameter status summary */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="pb-1.5 pr-3 font-medium">Parameter</th>
                  <th className="pb-1.5 pr-3 font-medium">Reading</th>
                  <th className="pb-1.5 pr-3 font-medium">Ideal</th>
                  <th className="pb-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {parameterRows.map((p) => (
                  <tr key={p.key} className="border-t border-border">
                    <td className="py-2 pr-3 font-medium text-foreground">
                      {p.label}
                    </td>
                    <td className="py-2 pr-3 font-mono tabular-nums text-foreground">
                      {p.value !== null ? p.value : "—"}
                    </td>
                    <td className="py-2 pr-3 font-mono tabular-nums text-muted-foreground">
                      {p.ideal ? `${p.ideal.min}–${p.ideal.max}${p.unit ? ` ${p.unit}` : ""}` : "—"}
                    </td>
                    <td className="py-2">
                      {p.status === "empty" ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : p.status === "ideal" ? (
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3.5" />
                          Ideal
                        </span>
                      ) : p.status === "low" ? (
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="size-3.5" />
                          Low
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="size-3.5" />
                          High
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {/* Temperature row */}
                <tr className="border-t border-border">
                  <td className="py-2 pr-3 font-medium text-foreground">
                    Temperature
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-foreground">
                    {hasTemp ? `${readings.temperature}°F` : "—"}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-muted-foreground">—</td>
                  <td className="py-2">
                    {hasTemp ? (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                        Recorded
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Minus className="size-3.5" />
                        Needed for LSI
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Chemical Recommendations Card */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-card-foreground">
            Chemical Recommendations
          </h2>
          {!completed && !isOthersVisit && (
            <AddChemicalDialog onAdd={handleAddChemical} />
          )}
        </div>
        <ChemicalRecommendations
          recommendations={recommendations}
          poolVolume={visit.pool.volume}
          checked={checkedChemicals}
          onToggle={handleToggleChemical}
          disabled={completed || isOthersVisit}
        />

        {manualChemicals.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Added manually
            </p>
            {manualChemicals.map((chem, i) => (
              <div
                key={`${chem.name}-${i}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {chem.name}
                    </span>
                    {chem.amount > 0 && (
                      <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                        {chem.amount} {chem.unit}
                      </span>
                    )}
                  </div>
                </div>
                  {!completed && !isOthersVisit && (
                  <button
                    type="button"
                    onClick={() => handleRemoveChemical(i)}
                    className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={`Remove ${chem.name}`}
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Technician Notes */}
      <div className="rounded-xl border border-border bg-card p-4">
        <VisitNotes
          value={notes ?? ""}
          onChange={(val) => setValue("notes", val)}
          disabled={completed || isOthersVisit}
        />
      </div>

      {/* Action Buttons */}
      {!completed && !isOthersVisit && (
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-3">
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
              className="bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
              onClick={handleComplete}
              disabled={!allFieldsFilled || isSubmitting || saving !== null}
            >
              {saving === "complete" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Complete &amp; Send Report
            </Button>
          </div>
          {!allFieldsFilled && (
            <p className="text-xs text-muted-foreground">
              Enter all 6 readings to complete the report
            </p>
          )}
        </div>
      )}
    </form>
  )
}
