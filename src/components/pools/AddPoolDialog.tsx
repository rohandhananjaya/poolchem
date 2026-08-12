"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { toast } from "sonner"

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
import {
  createPoolAction,
  type FormState,
} from "@/app/(dashboard)/pools/actions"
import { cn } from "@/lib/utils"

const INITIAL_STATE: FormState = { ok: false }

const selectClasses = cn(
  "flex h-9 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  "dark:bg-input/30",
)

interface AddPoolDialogProps {
  /** The company's properties, rendered as a Location select when present. */
  properties?: { id: string; name: string }[]
  /**
   * Pre-select a property (e.g. when opened from a property card).
   * When set, the Location select is locked to that property — the pool is
   * always created under it and cannot be reassigned from this dialog.
   */
  defaultPropertyId?: string
  /** Overrides the default "Add Pool" trigger button. */
  trigger?: React.ReactNode
}

export function AddPoolDialog({
  properties,
  defaultPropertyId,
  trigger,
}: AddPoolDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const router = useRouter()

  const formRef = React.useRef<HTMLFormElement>(null)

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createPoolAction(INITIAL_STATE, formData)
      if (result.ok) {
        toast.success("Pool created.")
        setOpen(false)
        formRef.current?.reset()
        router.refresh()
      } else if (result.error) {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) formRef.current?.reset()
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" size="lg">
            <Plus />
            Add Pool
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Pool</DialogTitle>
          <DialogDescription>
            Add a new pool to your company.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Pool name</Label>
              <Input id="name" name="name" required autoFocus />
            </div>
            {properties && properties.length > 0 && (
              <div className="grid gap-1.5">
                <Label htmlFor="propertyId">Location</Label>
                {defaultPropertyId ? (
                  <>
                    <input
                      type="hidden"
                      name="propertyId"
                      value={defaultPropertyId}
                    />
                    <select
                      id="propertyId"
                      name="propertyId"
                      defaultValue={defaultPropertyId}
                      disabled
                      className={selectClasses}
                    >
                      {properties.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.name}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <select
                    id="propertyId"
                    name="propertyId"
                    defaultValue=""
                    className={selectClasses}
                  >
                    <option value="">No location</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="volume">Volume (gallons)</Label>
              <Input
                id="volume"
                name="volume"
                type="number"
                min={1}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="address">Address</Label>
              <Input id="address" name="address" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="homeownerEmail">Email</Label>
              <Input id="homeownerEmail" name="homeownerEmail" type="email" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="homeownerPhone">Phone no</Label>
              <Input id="homeownerPhone" name="homeownerPhone" type="tel" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
