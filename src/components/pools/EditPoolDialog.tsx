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

const INITIAL_STATE: FormState = { ok: false }

interface EditPoolDialogProps {
  pool: {
    id: string
    name: string
    volume: number
    address: string | null
    notes: string | null
    isActive: boolean
  }
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function EditPoolDialog({ pool, open, onOpenChange }: EditPoolDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const router = useRouter()

  const formRef = React.useRef<HTMLFormElement>(null)

  const isControlled = open !== undefined && onOpenChange !== undefined
  const isOpen = isControlled ? open : internalOpen
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen

  function handleSubmit(formData: FormData) {
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
      {!isControlled && (
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="w-full justify-start">
            <Pencil className="size-4" />
            Edit
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {pool.name}</DialogTitle>
          <DialogDescription>
            Update pool details.
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
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-volume">Volume (gallons)</Label>
              <Input
                id="edit-volume"
                name="volume"
                type="number"
                min={1}
                defaultValue={pool.volume}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                name="address"
                defaultValue={pool.address ?? ""}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-notes">Notes</Label>
              <Input
                id="edit-notes"
                name="notes"
                defaultValue={pool.notes ?? ""}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={pool.isActive}
                className="size-4 rounded border-border accent-primary"
              />
              Active
            </label>
          </div>

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
        </form>
      </DialogContent>
    </Dialog>

    <DeletePoolDialog
      poolId={pool.id}
      poolName={pool.name}
      open={deleteOpen}
      onOpenChange={setDeleteOpen}
    />
    </>
  )
}
