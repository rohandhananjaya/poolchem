"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"
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
  updatePropertyAction,
  type FormState,
} from "@/app/(dashboard)/properties/actions"

const INITIAL_STATE: FormState = { ok: false }

interface EditPropertyDialogProps {
  property: {
    id: string
    name: string
    address: string | null
    notes: string | null
  }
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function EditPropertyDialog({
  property,
  open,
  onOpenChange,
}: EditPropertyDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const router = useRouter()

  const formRef = React.useRef<HTMLFormElement>(null)

  const isControlled = open !== undefined && onOpenChange !== undefined
  const isOpen = isControlled ? open : internalOpen
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen

  function handleSubmit(formData: FormData) {
    formData.set("propertyId", property.id)

    startTransition(async () => {
      const result = await updatePropertyAction(INITIAL_STATE, formData)
      if (result.ok) {
        toast.success("Property updated.")
        setIsOpen(false)
        router.refresh()
      } else if (result.error) {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next)
        if (!next) formRef.current?.reset()
      }}
    >
      {!isControlled && (
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start"
          >
            <Pencil className="size-4" />
            Edit
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {property.name}</DialogTitle>
          <DialogDescription>Update property details.</DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-name">Property name</Label>
              <Input
                id="edit-name"
                name="name"
                defaultValue={property.name}
                required
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                name="address"
                defaultValue={property.address ?? ""}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-notes">Notes</Label>
              <Input
                id="edit-notes"
                name="notes"
                defaultValue={property.notes ?? ""}
              />
            </div>
          </div>

          <DialogFooter>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
