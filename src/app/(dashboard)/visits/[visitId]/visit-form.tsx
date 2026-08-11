"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { Loader2, AlertTriangle, CheckCircle2, Minus, RefreshCw, X } from "lucide-react"
import type { Resolver } from "react-hook-form"
import { toast } from "sonner"

import { ERROR_MESSAGES } from "@/lib/errors"
import { readingsSchema } from "@/lib/validation/visit-readings"

import {
  getWaterHealthScore,
  calculateLSI,
  getChemicalRecommendations,
  getIdealRange,
  type WaterReadingInput as WaterReading,
  type ChemicalRecommendation,
  type LSIResult,
} from "@/lib/pool-chemistry"
import { Button } from "@/components/ui/button"
import { WaterReadingInput } from "@/components/visits/WaterReadingInput"
import { WaterHealthGauge } from "@/components/visits/WaterHealthGauge"
import { ChemicalRecommendations } from "@/components/visits/ChemicalRecommendations"
import { AddChemicalDialog } from "@/components/visits/AddChemicalDialog"
import { VisitNotes } from "@/components/visits/VisitNotes"
import {
  completeVisitAction,
  type VisitFormValues,
} from "./actions"
import type { VisitReadings, VisitChemical } from "@/lib/db/visits"
import { deleteDraft, saveDraft, getDraft } from "@/lib/offline/draft-visits"
import {
  deleteEntriesForVisit,
  deleteDeadForVisit,
  enqueue,
} from "@/lib/offline/mutation-queue"
import {
  createClientMutationId,
  type OfflineChemical,
  type OfflineReadings,
} from "@/lib/offline/types"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { useVisitSyncStatus } from "@/hooks/use-visit-sync-status"
import { SyncStatusBadge } from "@/components/visits/SyncStatusBadge"

const formSchema = z.object({
  bodies: z.array(
    z.object({
      serviceVisitPoolId: z.string(),
      readings: readingsSchema,
    }),
  ),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface SerializedVisit {
  id: string
  status: string
  notes: string | null
  nextServiceDate: string | null
  /** Monotonic revision — seeds `knownVersion` for the stale-write guard. */
  version: number
  /** Legacy first-pool header (multi-body visits surface under their first pool). */
  pool: {
    name: string
    address: string | null
    image: string | null
    volume: number
  }
  /** One entry per body of water the visit serves. */
  serviceVisitPools: Array<{
    id: string
    pool: {
      name: string
      address: string | null
      image: string | null
      volume: number
    }
  }>
  waterReadings: Array<{
    /** The body this reading was recorded against; null on legacy rows. */
    serviceVisitPoolId: string | null
    ph: number
    freeChlorine: number
    totalAlkalinity: number
    calciumHardness: number
    cyanuricAcid: number
    temperature: number
  }>
  chemicalsAdded: Array<{
    /** The body this chemical was recorded against; null on legacy rows. */
    serviceVisitPoolId: string | null
    name: string
    amount: number
    unit: string
  }>
}

/** Per-body chemical form state (checked recommendations + hand-added). */
interface BodyChemicalState {
  checked: Record<string, boolean>
  manual: VisitChemical[]
}

/** A body of water's derived editor state (one per `serviceVisitPools` row). */
interface BodyEditor {
  joinId: string
  poolName: string
  volume: number
  readings: Record<string, number | undefined>
  hasCoreReadings: boolean
  allFieldsFilled: boolean
  waterHealth: ReturnType<typeof getWaterHealthScore> | null
  lsi: LSIResult | null
  recommendations: ChemicalRecommendation[]
  parameterRows: Array<{
    key: string
    label: string
    unit: string
    value: number | null
    ideal: { min: number; max: number } | null
    status: "empty" | "low" | "high" | "ideal" | "info"
  }>
  hasTemp: boolean
}

const EMPTY_READINGS = {
  ph: undefined,
  freeChlorine: undefined,
  totalAlkalinity: undefined,
  calciumHardness: undefined,
  cyanuricAcid: undefined,
  temperature: undefined,
}

const READING_KEYS = [
  "ph",
  "freeChlorine",
  "totalAlkalinity",
  "calciumHardness",
  "cyanuricAcid",
  "temperature",
] as const

type ReadingKey = (typeof READING_KEYS)[number]

interface VisitFormProps {
  companyId: string
  visit: SerializedVisit
  lastReadings: VisitReadings | null
  currentUser: { id: string; name: string }
  techId: string | null
  canUseLSI: boolean
}

export function VisitForm({
  companyId,
  visit,
  lastReadings,
  currentUser,
  techId,
  canUseLSI,
}: VisitFormProps) {
  const router = useRouter()
  const completed = visit.status === "COMPLETED"
  const inProgress = visit.status === "IN_PROGRESS"
  const isOthersVisit = inProgress && !!techId && techId !== currentUser.id

  // One editor per body of water. A pre-backfill visit has no join rows yet, so
  // fall back to a single legacy body pinned to the visit's legacy pool (the
  // server rejects the write with a clear error if the backfill hasn't run).
  const multiBody = Boolean(visit.serviceVisitPools?.length)
  const displayBodies = multiBody
    ? visit.serviceVisitPools
    : [{ id: "legacy", pool: visit.pool }]

  const storedReadingFor = (joinId: string) => {
    if (multiBody) {
      return (
        visit.waterReadings.find((r) => r.serviceVisitPoolId === joinId) ?? null
      )
    }
    return visit.waterReadings[0] ?? null
  }
  const storedChemicalsFor = (joinId: string) => {
    if (multiBody) {
      return visit.chemicalsAdded.filter((c) => c.serviceVisitPoolId === joinId)
    }
    return visit.chemicalsAdded
  }

  const defaultReadingsFor = (joinId: string) => {
    const stored = storedReadingFor(joinId)
    return stored
      ? {
          ph: stored.ph,
          freeChlorine: stored.freeChlorine,
          totalAlkalinity: stored.totalAlkalinity,
          calciumHardness: stored.calciumHardness,
          cyanuricAcid: stored.cyanuricAcid,
          temperature: stored.temperature,
        }
      : { ...EMPTY_READINGS }
  }

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema) as unknown as Resolver<FormData>,
    defaultValues: {
      bodies: displayBodies.map((join) => ({
        serviceVisitPoolId: join.id,
        readings: defaultReadingsFor(join.id),
      })),
      notes: visit.notes ?? "",
    },
    disabled: completed || isOthersVisit,
    mode: "onChange",
  })

  // Nested RHF objects are mutated in place, so `watch("bodies")` returns a
  // referentially-stable array across renders even as individual readings
  // change. Read the primitives back out each render and compute the per-body
  // derived data fresh — the chemistry calls are cheap (6 params per body) and
  // the analysis/recommendations must never freeze at their initial state.
  const bodiesValues = watch("bodies")
  const notes = watch("notes")

  const hasValidationErrors =
    (
      (errors.bodies ?? []) as Array<{
        readings?: Record<string, unknown>
      }>
    ).some((body) => body?.readings && Object.keys(body.readings).length > 0) ??
    false

  const [nextServiceDate, setNextServiceDate] = useState<string>(
    visit.nextServiceDate
      ? new Date(visit.nextServiceDate).toISOString().split("T")[0]
      : "",
  )

  // Revision this client last observed from the server. Seeded from the
  // serialized visit and re-based from every successful saveDraft replay (via
  // `onReplayApplied`) so the next completion isn't falsely rejected as a
  // conflict after our own save bumped the version. A ref, not state: it is
  // only read at submit time (buildPayload / saveDraft), and a `setState` read
  // would observe a stale value the moment a just-returned drain replay
  // re-based it.
  const knownVersionRef = useRef<number>(visit.version)

  // Re-seed the known revision whenever the serialized visit's version changes.
  // `useRef` alone only captures the mount value, so a `router.refresh()` that
  // follows a stale-write conflict — or a refresh reflecting a status change,
  // reassignment, cancellation, or another device's draft save — would otherwise
  // keep the old revision and loop: the conflict recovery tells the tech to
  // re-apply, but the re-apply would fail again against the stale revision.
  // Safe against `onReplayApplied`: the prop only changes on refresh/navigation,
  // so this never clobbers a re-base that ran against an unchanged prop.
  useEffect(() => {
    knownVersionRef.current = visit.version
  }, [visit.version])

  // Per-body chemical state, seeded from the stored rows on a completed visit.
  // On a completed visit, chemicals recorded against a body that the engine
  // wouldn't have recommended for that body's saved reading were added manually.
  const [chemicalState, setChemicalState] = useState<BodyChemicalState[]>(() =>
    displayBodies.map((join) => {
      const stored = storedReadingFor(join.id)
      const seed = completed && Boolean(stored)
      const storedChems = storedChemicalsFor(join.id)
      const recNames = seed
        ? new Set(
            getChemicalRecommendations(
              stored as unknown as WaterReading,
              join.pool.volume,
            ).map((r) => r.chemical),
          )
        : new Set<string>()
      const checked: Record<string, boolean> = {}
      for (const c of storedChems) if (seed) checked[c.name] = true
      const manual = seed
        ? storedChems.filter((c) => !recNames.has(c.name))
        : []
      return { checked, manual }
    }),
  )

  const handleToggleChemical = useCallback(
    (bodyIndex: number, chemical: string) => {
      setChemicalState((prev) =>
        prev.map((state, i) =>
          i === bodyIndex
            ? {
                ...state,
                checked: {
                  ...state.checked,
                  [chemical]: !state.checked[chemical],
                },
              }
            : state,
        ),
      )
    },
    [],
  )

  const handleAddChemical = useCallback(
    (bodyIndex: number, chemical: VisitChemical) => {
      setChemicalState((prev) =>
        prev.map((state, i) =>
          i === bodyIndex
            ? { ...state, manual: [...state.manual, chemical] }
            : state,
        ),
      )
    },
    [],
  )

  const handleRemoveChemical = useCallback(
    (bodyIndex: number, index: number) => {
      setChemicalState((prev) =>
        prev.map((state, i) =>
          i === bodyIndex
            ? { ...state, manual: state.manual.filter((_, j) => j !== index) }
            : state,
        ),
      )
    },
    [],
  )

  // Per-body derived editor state, computed fresh each render.
  const editors: BodyEditor[] = displayBodies.map((join, i) => {
    const r = bodiesValues?.[i]?.readings ?? {}
    const readings = { ...r }

    const hasCoreReadings =
      readings.ph != null &&
      readings.freeChlorine != null &&
      readings.totalAlkalinity != null &&
      readings.calciumHardness != null &&
      readings.cyanuricAcid != null
    const allFieldsFilled = hasCoreReadings && readings.temperature != null

    // Water health score works with 5 core params (temperature is optional).
    const waterHealth = hasCoreReadings
      ? getWaterHealthScore(readings as unknown as WaterReading)
      : null

    const lsi =
      canUseLSI && hasCoreReadings && readings.temperature != null
        ? calculateLSI(
            readings.ph as number,
            readings.temperature as number,
            readings.calciumHardness as number,
            readings.totalAlkalinity as number,
          )
        : null

    const recommendations = hasCoreReadings
      ? getChemicalRecommendations(
          readings as unknown as WaterReading,
          join.pool.volume,
        )
      : []

    const configs: Array<{ key: ReadingKey; label: string; unit: string }> = [
      { key: "ph", label: "pH", unit: "" },
      { key: "freeChlorine", label: "Free Chlorine", unit: "ppm" },
      { key: "totalAlkalinity", label: "Total Alkalinity", unit: "ppm" },
      { key: "calciumHardness", label: "Calcium Hardness", unit: "ppm" },
      { key: "cyanuricAcid", label: "Cyanuric Acid", unit: "ppm" },
    ]
    const parameterRows = configs.map(({ key, label, unit }) => {
      const value = readings[key]
      if (value === undefined || value === null) {
        return {
          key,
          label,
          unit,
          value: null,
          ideal: null,
          status: "empty" as const,
        }
      }
      try {
        const range = getIdealRange(key)
        const status: "low" | "high" | "ideal" =
          value < range.min ? "low" : value > range.max ? "high" : "ideal"
        return {
          key,
          label,
          unit,
          value,
          ideal: { min: range.min, max: range.max },
          status,
        }
      } catch {
        return { key, label, unit, value, ideal: null, status: "info" as const }
      }
    })

    return {
      joinId: join.id,
      poolName: join.pool.name,
      volume: join.pool.volume,
      readings,
      hasCoreReadings,
      allFieldsFilled,
      waterHealth,
      lsi,
      recommendations,
      parameterRows,
      hasTemp: readings.temperature != null,
    }
  })

  const allFieldsFilled = editors.every((editor) => editor.allFieldsFilled)

  const buildPayload = useCallback(
    (data: FormData): VisitFormValues => {
      const payload: VisitFormValues = {
        // Readings stay optional/faithful here — blank fields are coerced to 0
        // at the server boundary (actions.ts normalizeReadings), so a local
        // draft payload records exactly what the tech entered. One body entry
        // per join row, mirroring the server's whole-visit replacement.
        bodies: displayBodies.map((join, i) => {
          const readings = { ...(data.bodies?.[i]?.readings ?? {}) }
          // Compute the recommendations fresh from the submitted readings so a
          // checked chemical's dose always reflects THIS body's volume.
          const recommendations = getChemicalRecommendations(
            readings as unknown as WaterReading,
            join.pool.volume,
          )
          const checked = chemicalState[i]?.checked ?? {}
          const manual = chemicalState[i]?.manual ?? []
          return {
            serviceVisitPoolId: join.id,
            readings,
            chemicals: [
              ...Object.entries(checked)
                .filter(([, isChecked]) => isChecked)
                .map(([name]) => {
                  const rec = recommendations.find(
                    (recommendation) => recommendation.chemical === name,
                  )
                  return {
                    name,
                    amount: rec?.amount ?? 0,
                    unit: rec?.unit ?? "",
                  }
                }),
              ...manual,
            ],
          }
        }),
        notes: data.notes ?? "",
        nextServiceDate: nextServiceDate || undefined,
      }
      payload.clientMutationId ??= createClientMutationId()
      // Guard the terminal completion against stale edits from another device;
      // drafts are last-write-wins so saveDraft ignores this on the server.
      payload.expectedVersion = knownVersionRef.current
      return payload
    },
    [displayBodies, chemicalState, nextServiceDate],
  )

  const [saving, setSaving] = useState<"draft" | "complete" | null>(null)

  const { online } = useOnlineStatus()

  const sync = useVisitSyncStatus({
    companyId,
    visitId: visit.id,
    enabled: !completed && !isOthersVisit,
    // Re-base the known revision after each successful replay — the server
    // bumped `version` for our own write, so a stale expectedVersion would
    // otherwise falsely reject the next completion (false self-conflict). The
    // ref write is synchronous so a completion that awaits the drain can read
    // the fresh revision immediately.
    onReplayApplied: (v) => {
      if (v !== undefined) knownVersionRef.current = v
    },
  })
  // `drain` and `retry` are stable; destructuring avoids re-creating the
  // handlers every render (`sync` itself is a fresh object each render).
  const {
    status: syncStatus,
    counts: syncCounts,
    retry: retryDead,
    drain,
  } = sync

  const handleSaveDraft = useCallback(async () => {
    setSaving("draft")
    try {
      let valid = true
      await handleSubmit(
        async (data) => {
          const payload = buildPayload(data)
          // Write-through: persist locally first (instant Dexie write, no
          // network await), then enqueue the mutation for replay. The Server
          // Action is only reached via the queue processor's replay, never
          // awaited here. The known server revision rides along so the next
          // completion is guarded against stale writes from another device.
          await saveDraft(
            companyId,
            currentUser.id,
            visit.id,
            payload,
            knownVersionRef.current,
          )
          await enqueue(companyId, "saveDraft", visit.id, payload)
          // A re-save supersedes any stale dead-lettered entries for the visit.
          await deleteDeadForVisit(companyId, visit.id)
        },
        () => {
          valid = false
        },
      )()
      if (!valid) {
        toast.error("Please fix the highlighted fields before saving.")
        return
      }
      toast.info(
        online
          ? "Saved locally"
          : "Saved offline — will sync when back online",
      )
      // Write-through: flush the queue while connected. The processor gates on
      // navigator.onLine, so this is a no-op when actually offline; retry/
      // backoff/dead-letter state is the processor's job, not the form's. The
      // flush is awaited (not fire-and-forget) so the re-base from
      // `onReplayApplied` lands before the button unlocks — a completion that
      // followed an un-flushed save would otherwise false-conflict against the
      // version the save's own replay just bumped.
      await drain()
    } catch (e) {
      console.error("Save draft failed:", e)
      toast.error(ERROR_MESSAGES.SAVE_FAILED)
    } finally {
      setSaving(null)
    }
  }, [handleSubmit, buildPayload, visit.id, companyId, currentUser.id, online, drain])

  // Restore a locally-persisted draft on load so an offline save survives a
  // reload. Hydrates the same state the tech was editing (per-body readings,
  // notes, next-service date, per-body chemicals) using the completed-visit
  // seed logic.
  useEffect(() => {
    let cancelled = false
    void getDraft(companyId, visit.id).then((draft) => {
      if (cancelled || !draft || completed || isOthersVisit) return
      // Only restore a draft this tech authored — a visit reassigned to a
      // second tech must not pull in the previous tech's unsaved edits.
      if (draft.techId !== currentUser.id) return
      const p = draft.payload
      // New per-body payload; a legacy single-body draft (saved before the
      // multi-body rework) maps onto the first display body.
      const draftBodies =
        p.bodies && p.bodies.length > 0
          ? p.bodies
          : [
              {
                serviceVisitPoolId: displayBodies[0]?.id ?? "legacy",
                readings: (p as { readings?: OfflineReadings }).readings ?? {},
                chemicals: (p as { chemicals?: OfflineChemical[] }).chemicals ?? [],
              },
            ]
      setValue("notes", p.notes ?? "")
      if (p.nextServiceDate) setNextServiceDate(p.nextServiceDate)

      const restored: Array<BodyChemicalState | null> = displayBodies.map(
        (join, i) => {
          const body =
            draftBodies.find((b) => b.serviceVisitPoolId === join.id) ??
            draftBodies[0]
          if (!body) return null
          const r = body.readings
          if (r.ph !== undefined) setValue(`bodies.${i}.readings.ph`, r.ph)
          if (r.freeChlorine !== undefined) setValue(`bodies.${i}.readings.freeChlorine`, r.freeChlorine)
          if (r.totalAlkalinity !== undefined) setValue(`bodies.${i}.readings.totalAlkalinity`, r.totalAlkalinity)
          if (r.calciumHardness !== undefined) setValue(`bodies.${i}.readings.calciumHardness`, r.calciumHardness)
          if (r.cyanuricAcid !== undefined) setValue(`bodies.${i}.readings.cyanuricAcid`, r.cyanuricAcid)
          if (r.temperature !== undefined) setValue(`bodies.${i}.readings.temperature`, r.temperature)

          if (body.chemicals.length === 0) {
            return { checked: {}, manual: [] }
          }
          const restoredReadings = {
            ph: r.ph ?? 0,
            freeChlorine: r.freeChlorine ?? 0,
            totalAlkalinity: r.totalAlkalinity ?? 0,
            calciumHardness: r.calciumHardness ?? 0,
            cyanuricAcid: r.cyanuricAcid ?? 0,
            temperature: r.temperature ?? 0,
          } as unknown as WaterReading
          const recNames = new Set(
            getChemicalRecommendations(restoredReadings, join.pool.volume).map(
              (rec) => rec.chemical,
            ),
          )
          const manual = body.chemicals.filter((c) => !recNames.has(c.name))
          const checked: Record<string, boolean> = {}
          for (const c of body.chemicals) checked[c.name] = true
          return { checked, manual }
        },
      )
      setChemicalState((prev) =>
        prev.map((state, i) => restored[i] ?? state),
      )
    })
    return () => {
      cancelled = true
    }
  }, [companyId, visit.id, setValue, completed, isOthersVisit, displayBodies, currentUser.id])

  const handleComplete = useCallback(async () => {
    if (!allFieldsFilled) {
      toast.error("Please fill in all water readings before completing the report.")
      return
    }
    setSaving("complete")
    try {
      // Flush any queued saveDraft replays first so `knownVersionRef` reflects
      // the version those writes bumped — a completion sent with the stale
      // pre-save revision would false-conflict against our own in-flight save.
      // A skipped sweep (single-flight, or offline) leaves the queue untouched;
      // the completion still goes out with the revision we have.
      await drain()
      let valid = true
      await handleSubmit(
        async (data) => {
          await completeVisitAction(visit.id, buildPayload(data))
          // The visit is now complete server-side; drop any offline draft and
          // queued saveDraft entries so a stale replay isn't retried against a
          // visit that rejects draft writes. Best-effort: a local cleanup
          // failure must not mask the successful server completion.
          try {
            await deleteDraft(companyId, visit.id)
            await deleteEntriesForVisit(companyId, visit.id)
          } catch (e) {
            console.error("Failed to clear offline data for completed visit:", e)
          }
        },
        () => {
          valid = false
        },
      )()
      if (!valid) {
        toast.error("Please fix the highlighted fields before completing the report.")
        return
      }
      toast.success("Report sent successfully")
      router.push(`/visits/${visit.id}`)
    } catch (e) {
      console.error("Complete visit failed:", e)
      // Stale-write conflict: another device bumped the visit's version since we
      // last synced, so our completion would clobber newer state. Surface the
      // user-safe error copy and reload authoritative server state — the tech
      // re-applies their edits against the fresh version.
      if (e instanceof Error && e.message.includes("updated on another device")) {
        toast.error(e.message)
        router.refresh()
        return
      }
      toast.error(ERROR_MESSAGES.SAVE_FAILED)
    } finally {
      setSaving(null)
    }
  }, [handleSubmit, buildPayload, visit.id, allFieldsFilled, router, companyId, drain])

  return (
    <form className="mt-6 space-y-6">
      {/* Per-body water test, analysis, and recommendations */}
      {editors.map((editor, bodyIndex) => (
        <div key={editor.joinId} className="space-y-6">
          {/* Water Test Input Card */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-card-foreground">
                {multiBody ? editor.poolName : "Log Readings"}
              </h2>
              {!completed && !isOthersVisit && (
                <span className="text-xs text-muted-foreground">
                  {[editor.readings.ph, editor.readings.freeChlorine, editor.readings.totalAlkalinity, editor.readings.calciumHardness, editor.readings.cyanuricAcid, editor.readings.temperature]
                    .filter((v) => v !== undefined && v !== null).length}/6
                </span>
              )}
            </div>

            {multiBody && (
              <p className="-mt-3 mb-3 text-xs text-muted-foreground">
                {editor.volume.toLocaleString()} gal
              </p>
            )}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <WaterReadingInput
                name={`bodies.${bodyIndex}.readings.ph`}
                label="pH"
                unit=""
                control={control}
                disabled={completed || isOthersVisit}
                lastReading={
                  completed || isOthersVisit
                    ? null
                    : bodyIndex === 0
                      ? lastReadings?.ph ?? undefined
                      : undefined
                }
              />
              <WaterReadingInput
                name={`bodies.${bodyIndex}.readings.freeChlorine`}
                label="Free Chlorine"
                unit="ppm"
                control={control}
                disabled={completed || isOthersVisit}
                lastReading={
                  completed || isOthersVisit
                    ? null
                    : bodyIndex === 0
                      ? lastReadings?.freeChlorine ?? undefined
                      : undefined
                }
              />
              <WaterReadingInput
                name={`bodies.${bodyIndex}.readings.totalAlkalinity`}
                label="Total Alkalinity"
                unit="ppm"
                control={control}
                disabled={completed || isOthersVisit}
                lastReading={
                  completed || isOthersVisit
                    ? null
                    : bodyIndex === 0
                      ? lastReadings?.totalAlkalinity ?? undefined
                      : undefined
                }
              />
              <WaterReadingInput
                name={`bodies.${bodyIndex}.readings.calciumHardness`}
                label="Calcium Hardness"
                unit="ppm"
                control={control}
                disabled={completed || isOthersVisit}
                lastReading={
                  completed || isOthersVisit
                    ? null
                    : bodyIndex === 0
                      ? lastReadings?.calciumHardness ?? undefined
                      : undefined
                }
              />
              <WaterReadingInput
                name={`bodies.${bodyIndex}.readings.cyanuricAcid`}
                label="Cyanuric Acid"
                unit="ppm"
                control={control}
                disabled={completed || isOthersVisit}
                lastReading={
                  completed || isOthersVisit
                    ? null
                    : bodyIndex === 0
                      ? lastReadings?.cyanuricAcid ?? undefined
                      : undefined
                }
              />
              <WaterReadingInput
                name={`bodies.${bodyIndex}.readings.temperature`}
                label="Temperature"
                unit="°F"
                control={control}
                disabled={completed || isOthersVisit}
                lastReading={
                  completed || isOthersVisit
                    ? null
                    : bodyIndex === 0
                      ? lastReadings?.temperature ?? undefined
                      : undefined
                }
              />
            </div>
          </div>

          {/* Results Card — shows when 5 core params are entered */}
          {editor.hasCoreReadings && editor.waterHealth && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-4 text-sm font-semibold text-card-foreground">
                Water Analysis
              </h2>

              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-around">
                <WaterHealthGauge
                  score={editor.waterHealth.score}
                  status={editor.waterHealth.status}
                  lsi={editor.lsi}
                />

                <div className="flex flex-col gap-3 sm:min-w-0 sm:flex-1">
                  {editor.waterHealth.issues.length > 0 && (
                    <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950/30">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="size-4" />
                        <span>
                          {editor.waterHealth.issues.length} parameter
                          {editor.waterHealth.issues.length > 1 ? "s" : ""} need
                          attention
                        </span>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {editor.waterHealth.issues.map((issue, issueIndex) => (
                          <li
                            key={issueIndex}
                            className="text-xs text-amber-700 dark:text-amber-400"
                          >
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {editor.waterHealth.issues.length === 0 && (
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
                    {editor.parameterRows.map((p) => (
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
                        {editor.hasTemp ? `${editor.readings.temperature}°F` : "—"}
                      </td>
                      <td className="py-2 pr-3 font-mono tabular-nums text-muted-foreground">—</td>
                      <td className="py-2">
                        {editor.hasTemp ? (
                          <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
                            <CheckCircle2 className="size-3.5 text-emerald-500" />
                            Recorded
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Minus className="size-3.5" />
                            {canUseLSI ? "Needed for LSI" : "Optional"}
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
                <AddChemicalDialog onAdd={(chem) => handleAddChemical(bodyIndex, chem)} />
              )}
            </div>
            <ChemicalRecommendations
              recommendations={editor.recommendations}
              poolVolume={editor.volume}
              checked={chemicalState[bodyIndex]?.checked ?? {}}
              onToggle={(chemical) => handleToggleChemical(bodyIndex, chemical)}
              disabled={completed || isOthersVisit}
            />

            {(chemicalState[bodyIndex]?.manual.length ?? 0) > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Added manually
                </p>
                {chemicalState[bodyIndex]?.manual.map((chem, chemicalIndex) => (
                  <div
                    key={`${chem.name}-${chemicalIndex}`}
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
                        onClick={() => handleRemoveChemical(bodyIndex, chemicalIndex)}
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
        </div>
      ))}

      {/* Technician Notes */}
      <div className="rounded-xl border border-border bg-card p-4">
        <VisitNotes
          value={notes ?? ""}
          onChange={(val) => setValue("notes", val)}
          disabled={completed || isOthersVisit}
        />
      </div>

      {/* Next Service Date */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-card-foreground">
          Next Service Date
        </h2>
        <p className="mb-2 mt-1 text-xs text-muted-foreground">
          Set the date for the next scheduled service (optional)
        </p>
        <input
          type="date"
          value={nextServiceDate}
          onChange={(e) => setNextServiceDate(e.target.value)}
          min={new Date().toISOString().split("T")[0]}
          disabled={completed || isOthersVisit}
          className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* Action Buttons */}
      {!completed && !isOthersVisit && (
        <div className="flex flex-col items-end gap-2">
          <SyncStatusBadge status={syncStatus} counts={syncCounts} />
          {syncCounts.dead > 0 && (
            <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-xs text-destructive">
                {syncCounts.dead} queued change{syncCounts.dead > 1 ? "s" : ""} couldn
                &apos;t sync. Re-save or retry.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={retryDead}
                disabled={saving !== null}
              >
                <RefreshCw className="size-4" />
                Retry
              </Button>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleSaveDraft}
              disabled={isSubmitting || saving !== null || hasValidationErrors}
            >
              {saving === "draft" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Save Draft
            </Button>

            <Button
              type="button"
              size="lg"
              className="bg-brand-600 text-white hover:bg-brand-900 disabled:opacity-50"
              onClick={handleComplete}
              disabled={
                !allFieldsFilled ||
                isSubmitting ||
                saving !== null ||
                hasValidationErrors
              }
            >
              {saving === "complete" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Complete &amp; Send Report
            </Button>
          </div>
          {hasValidationErrors ? (
            <p className="text-xs text-destructive">
              Fix the highlighted reading before saving
            </p>
          ) : (
            !allFieldsFilled && (
              <p className="text-xs text-muted-foreground">
                Enter all 6 readings to complete the report
              </p>
            )
          )}
        </div>
      )}
    </form>
  )
}
