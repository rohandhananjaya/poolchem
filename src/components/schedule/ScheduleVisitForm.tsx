"use client"

import * as React from "react"
import { CalendarPlus, Check, Search } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  scheduleVisitAction,
  type ScheduleFormState,
} from "@/app/(dashboard)/schedule/actions"

export interface ScheduleVisitFormProps {
  pools: Array<{ id: string; name: string }>
  properties: Array<{ id: string; name: string; pools: Array<{ id: string; name: string }> }>
  techs: Array<{ id: string; name: string; email: string }>
  userRole: string
}

const INITIAL_STATE: ScheduleFormState = { ok: false }

const inputClasses = cn(
  "flex h-9 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  "dark:bg-input/30",
)

export function ScheduleVisitForm({ pools, properties, techs, userRole }: ScheduleVisitFormProps) {
  const [open, setOpen] = React.useState(false)
  const formRef = React.useRef<HTMLFormElement>(null)

  const isOwner = userRole === "OWNER" || userRole === "SUPER_ADMIN"
  const [selectedTechId, setSelectedTechId] = React.useState<string>("")
  const [techSearch, setTechSearch] = React.useState("")
  const techInputRef = React.useRef<HTMLInputElement>(null)

  const [location, setLocation] = React.useState<string>("")
  const [selectedPools, setSelectedPools] = React.useState<Set<string>>(new Set())

  const [pending, startTransition] = React.useTransition()

  function action(formData: FormData) {
    startTransition(async () => {
      const state = await scheduleVisitAction(INITIAL_STATE, formData)
      if (state.ok) {
        toast.success("Visit scheduled.")
        reset()
        setOpen(false)
      } else if (state.error) {
        toast.error(state.error)
      }
    })
  }

  const filteredTechs = React.useMemo(
    () =>
      techs.filter(
        (t) =>
          t.name.toLowerCase().includes(techSearch.toLowerCase()) ||
          t.email.toLowerCase().includes(techSearch.toLowerCase()),
      ),
    [techs, techSearch],
  )

  function reset() {
    setSelectedTechId("")
    setTechSearch("")
    setLocation("")
    setSelectedPools(new Set())
    formRef.current?.reset()
  }

  function togglePool(poolId: string) {
    setSelectedPools((prev) => {
      const next = new Set(prev)
      if (next.has(poolId)) next.delete(poolId)
      else next.add(poolId)
      return next
    })
  }

  const hasProperties = properties.length > 0
  const selectedProperty =
    hasProperties && location !== "" && location !== "individual"
      ? properties.find((property) => property.id === location) ?? null
      : null
  const needsPoolSelection = selectedProperty !== null
  const selectedCount = selectedPools.size
  const submitDisabled = pending || (needsPoolSelection && selectedCount === 0)

  /** Keep the hidden input in sync with the selected tech id. */
  React.useEffect(() => {
    if (techInputRef.current) {
      techInputRef.current.value = selectedTechId
    }
  }, [selectedTechId])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="lg">
          <CalendarPlus />
          Schedule a visit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule a visit</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={action} className="space-y-4">
          <input
            ref={techInputRef}
            type="hidden"
            name="techId"
            value={selectedTechId}
          />

          {!hasProperties ? (
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
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor="schedule-location">Location</Label>
              <select
                id="schedule-location"
                value={location}
                onChange={(event) => {
                  setLocation(event.target.value)
                  setSelectedPools(new Set())
                }}
                className={inputClasses}
              >
                <option value="" disabled>
                  Select a location…
                </option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name} —{" "}
                    {property.pools.length === 1
                      ? "1 pool"
                      : `${property.pools.length} pools`}
                  </option>
                ))}
                <option value="individual">Individual pool</option>
              </select>

              {selectedProperty !== null ? (
                <div>
                  {selectedProperty.pools.length === 0 ? (
                    <p className="rounded-lg border border-border bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
                      No pools at this location.
                    </p>
                  ) : (
                    <>
                      <ul className="max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
                        {selectedProperty.pools.map((pool) => {
                          const checked = selectedPools.has(pool.id)
                          return (
                            <li key={pool.id}>
                              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-muted">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePool(pool.id)}
                                  className="size-4 shrink-0 rounded border-border accent-primary"
                                />
                                <span className="min-w-0 truncate text-foreground">
                                  {pool.name}
                                </span>
                              </label>
                            </li>
                          )
                        })}
                      </ul>
                      {selectedCount === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Select at least one pool.
                        </p>
                      )}
                      {[...selectedPools].map((poolId) => (
                        <input
                          key={poolId}
                          type="hidden"
                          name="poolId"
                          value={poolId}
                        />
                      ))}
                    </>
                  )}
                </div>
              ) : location === "individual" ? (
                <select
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
              ) : null}
            </div>
          )}

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

          {/* Tech assignment */}
          <div className="grid gap-1.5">
            <Label>Assign to</Label>
            {isOwner ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search technicians…"
                    value={techSearch}
                    onChange={(e) => setTechSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>

                <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
                  {/* "Anyone can take" option */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTechId("")
                      setTechSearch("")
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                      selectedTechId === ""
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border",
                        selectedTechId === ""
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input",
                      )}
                    >
                      {selectedTechId === "" && <Check className="size-3" />}
                    </span>
                    <span className="font-medium">Anyone can take</span>
                  </button>

                  {filteredTechs.length === 0 ? (
                    <p className="px-2.5 py-3 text-center text-xs text-muted-foreground">
                      No technicians found.
                    </p>
                  ) : (
                    filteredTechs.map((tech) => (
                      <button
                        key={tech.id}
                        type="button"
                        onClick={() => {
                          setSelectedTechId(tech.id)
                          setTechSearch("")
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                          selectedTechId === tech.id
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-full border",
                            selectedTechId === tech.id
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input",
                          )}
                        >
                          {selectedTechId === tech.id && <Check className="size-3" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-foreground">{tech.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {tech.email}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-9 items-center rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground shadow-xs dark:bg-input/30">
                You (auto-assigned)
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset()
                setOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="lg" disabled={submitDisabled}>
              {pending
                ? "Scheduling…"
                : selectedCount > 1
                  ? `Schedule visit (${selectedCount} pools)`
                  : "Schedule visit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
