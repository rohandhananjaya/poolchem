"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { setPoolPropertyAction } from "@/app/(dashboard)/properties/actions"
import { AddPoolDialog } from "@/components/pools/AddPoolDialog"

interface PropertyPoolsManagerProps {
  propertyId: string
  /** Pools already attached to this property. */
  pools: { id: string; name: string }[]
  /** The company's ungrouped pools (eligible to be added). */
  ungroupedPools: { id: string; name: string }[]
  /** The company's properties, for the Location select on a new pool. */
  properties: { id: string; name: string }[]
}

export function PropertyPoolsManager({
  propertyId,
  pools,
  ungroupedPools,
  properties,
}: PropertyPoolsManagerProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [pending, startTransition] = React.useTransition()
  const router = useRouter()

  const filtered = ungroupedPools.filter((pool) =>
    pool.name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  function toggle(poolId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(poolId)) next.delete(poolId)
      else next.add(poolId)
      return next
    })
  }

  function handleAdd() {
    startTransition(async () => {
      for (const poolId of selected) {
        const result = await setPoolPropertyAction(poolId, propertyId)
        if (!result.ok && result.error) {
          toast.error(result.error)
          return
        }
      }
      toast.success(
        selected.size === 1 ? "Pool added." : `${selected.size} pools added.`,
      )
      setOpen(false)
      setSelected(new Set())
      setSearch("")
      router.refresh()
    })
  }

  function handleDetach(poolId: string) {
    startTransition(async () => {
      const result = await setPoolPropertyAction(poolId, null)
      if (result.ok) {
        toast.success("Pool detached.")
        router.refresh()
      } else if (result.error) {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Pools ({pools.length})
        </p>
        <div className="flex items-center gap-2">
          <AddPoolDialog
            properties={properties}
            defaultPropertyId={propertyId}
            trigger={
              <Button type="button" variant="outline" size="sm">
                <Plus className="size-4" />
                New pool
              </Button>
            }
          />
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={ungroupedPools.length === 0}
            >
              <Plus className="size-4" />
              Add pools
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add pools</DialogTitle>
              <DialogDescription>
                Select ungrouped pools to attach to this property.
              </DialogDescription>
            </DialogHeader>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search pools…"
                className="pl-9"
                autoFocus
              />
            </div>

            {filtered.length === 0 ? (
              <p className="rounded-lg border border-border bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
                No ungrouped pools available.
              </p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
                {filtered.map((pool) => {
                  const checked = selected.has(pool.id)
                  return (
                    <li key={pool.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(pool.id)}
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
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleAdd}
                disabled={selected.size === 0 || pending}
              >
                {pending
                  ? "Adding…"
                  : selected.size === 0
                    ? "Add"
                    : `Add ${selected.size}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {pools.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No pools attached to this property.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {pools.map((pool) => (
            <span
              key={pool.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
            >
              <span className="max-w-40 truncate">{pool.name}</span>
              <button
                type="button"
                aria-label={`Detach ${pool.name}`}
                onClick={() => handleDetach(pool.id)}
                disabled={pending}
                className="shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
