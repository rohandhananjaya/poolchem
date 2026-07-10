"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { VisitChemical } from "@/lib/db/visits"

const UNIT_OPTIONS = ["oz", "fl oz", "lbs", "gal", "tabs", "bags"]

/** Common pool chemicals offered as autosuggestions; free text is still allowed. */
const CHEMICAL_SUGGESTIONS = [
  "Soda Ash",
  "Muriatic Acid",
  "Sodium Bicarbonate",
  "Calcium Chloride",
  "Liquid Chlorine",
  "Cyanuric Acid",
  "Calcium Hypochlorite",
  "Trichlor Tabs",
  "Dichlor",
  "Sodium Bisulfate (Dry Acid)",
  "Algaecide",
  "Clarifier",
  "Flocculant",
  "Phosphate Remover",
  "Pool Salt",
  "Stabilizer",
  "Metal Sequestrant",
  "Enzyme Treatment",
]

export interface AddChemicalDialogProps {
  /** Called with the new chemical when the tech confirms the form. */
  onAdd: (chemical: VisitChemical) => void
  disabled?: boolean
}

export function AddChemicalDialog({ onAdd, disabled }: AddChemicalDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [unit, setUnit] = useState(UNIT_OPTIONS[0])

  const trimmedName = name.trim()
  const amountValue = Number(amount)
  const canSubmit =
    trimmedName.length > 0 && amount !== "" && Number.isFinite(amountValue)

  function reset() {
    setName("")
    setAmount("")
    setUnit(UNIT_OPTIONS[0])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    onAdd({ name: trimmedName, amount: amountValue, unit })
    reset()
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="xs" disabled={disabled}>
          <Plus />
          Add Chemical
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add chemical manually</DialogTitle>
          <DialogDescription>
            Log a chemical addition that wasn&apos;t in the recommendations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="chemical-name">Chemical</Label>
            <Input
              id="chemical-name"
              list="chemical-suggestions"
              autoFocus
              autoComplete="off"
              placeholder="Select or type a chemical"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <datalist id="chemical-suggestions">
              {CHEMICAL_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="chemical-amount">Amount</Label>
              <Input
                id="chemical-amount"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="w-28 space-y-1.5">
              <Label htmlFor="chemical-unit">Unit</Label>
              <select
                id="chemical-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="flex h-9 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
