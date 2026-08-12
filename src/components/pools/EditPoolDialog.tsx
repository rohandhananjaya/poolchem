"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2 } from "lucide-react"
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
  updatePoolAction,
  type FormState,
} from "@/app/(dashboard)/pools/actions"
import { DeletePoolDialog } from "./DeletePoolDialog"
import { cn } from "@/lib/utils"

const INITIAL_STATE: FormState = { ok: false }

const selectClasses = cn(
  "flex h-9 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  "dark:bg-input/30",
)

interface EditPoolDialogProps {
  pool: {
    id: string
    name: string
    volume: number
    address: string | null
    homeownerEmail: string | null
    homeownerPhone: string | null
    notes: string | null
    propertyId: string | null
    isActive: boolean
  }
  /** The company's properties, rendered as a Location select when present. */
  properties?: { id: string; name: string }[]
  /** When false, the dialog is a read-only detail view (no edit/delete). */
  canManage?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function EditPoolDialog({
  pool,
  properties,
  canManage = true,
  open,
  onOpenChange,
}: EditPoolDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const router = useRouter()

  const formRef = React.useRef<HTMLFormElement>(null)

  const isControlled = open !== undefined && onOpenChange !== undefined
  const isOpen = isControlled ? open : internalOpen
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen

  function handleSubmit(formData: FormData) {
    if (!canManage) return
    formData.set("poolId", pool.id)

    startTransition(async () => {
      const result = await updatePoolAction(INITIAL_STATE, formData)
      if (result.ok) {
        toast.success("Pool updated.")
        setIsOpen(false)
        router.refresh()
      } else if (result.error) {
        toast.error(result.error)
      }
    })
  }

  return (
    <>
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next)
        if (!next) {
          formRef.current?.reset()
        }
      }}
    >
      {!isControlled && canManage && (
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="w-full justify-start">
            <Pencil className="size-4" />
            Edit
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {canManage ? `Edit ${pool.name}` : pool.name}
          </DialogTitle>
          <DialogDescription>
            {canManage ? "Update pool details." : "Pool details."}
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-name">Pool name</Label>
              <Input
                id="edit-name"
                name="name"
                defaultValue={pool.name}
                required
                autoFocus={canManage}
                disabled={!canManage}
              />
            </div>
            {properties && properties.length > 0 && (
              <div className="grid gap-1.5">
                <Label htmlFor="edit-propertyId">Location</Label>
                <select
                  id="edit-propertyId"
                  name="propertyId"
                  defaultValue={pool.propertyId ?? ""}
                  disabled={!canManage}
                  className={selectClasses}
                >
                  <option value="">No location</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="edit-volume">Volume (gallons)</Label>
              <Input
                id="edit-volume"
                name="volume"
                type="number"
                min={1}
                defaultValue={pool.volume}
                required
                disabled={!canManage}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                name="address"
                defaultValue={pool.address ?? ""}
                disabled={!canManage}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-homeownerEmail">Email</Label>
              <Input
                id="edit-homeownerEmail"
                name="homeownerEmail"
                type="email"
                defaultValue={pool.homeownerEmail ?? ""}
                disabled={!canManage}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-homeownerPhone">Phone no</Label>
              <Input
                id="edit-homeownerPhone"
                name="homeownerPhone"
                type="tel"
                defaultValue={pool.homeownerPhone ?? ""}
                disabled={!canManage}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-notes">Notes</Label>
              <Input
                id="edit-notes"
                name="notes"
                defaultValue={pool.notes ?? ""}
                disabled={!canManage}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={pool.isActive}
                disabled={!canManage}
                className="size-4 rounded border-border accent-primary"
              />
              Active
            </label>
          </div>

          {canManage ? (
            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setIsOpen(false)
                  setDeleteOpen(true)
                }}
                disabled={pending}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save"}
                </Button>
              </div>
            </DialogFooter>
          ) : (
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>

    {canManage && (
      <DeletePoolDialog
        poolId={pool.id}
        poolName={pool.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    )}
    </>
  )
}
