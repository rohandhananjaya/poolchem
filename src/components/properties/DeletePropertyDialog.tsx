"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button, type buttonVariants } from "@/components/ui/button"
import { type VariantProps } from "class-variance-authority"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  deletePropertyAction,
  type FormState,
} from "@/app/(dashboard)/properties/actions"

const INITIAL_STATE: FormState = { ok: false }

interface DeletePropertyDialogProps {
  propertyId: string
  propertyName: string
  triggerClassName?: string
  triggerVariant?: VariantProps<typeof buttonVariants>["variant"]
  triggerSize?: VariantProps<typeof buttonVariants>["size"]
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DeletePropertyDialog({
  propertyId,
  propertyName,
  triggerClassName = "w-full justify-start text-destructive",
  triggerVariant = "ghost",
  triggerSize = "sm",
  open,
  onOpenChange,
}: DeletePropertyDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [confirmValue, setConfirmValue] = React.useState("")
  const [pending, startTransition] = React.useTransition()
  const router = useRouter()

  const isControlled = open !== undefined && onOpenChange !== undefined
  const isOpen = isControlled ? open : internalOpen
  const setOpen = isControlled ? onOpenChange : setInternalOpen

  const matches = confirmValue === propertyName

  function handleSubmit() {
    if (!matches) return

    const formData = new FormData()
    formData.set("propertyId", propertyId)
    formData.set("confirmName", propertyName)

    startTransition(async () => {
      const result = await deletePropertyAction(INITIAL_STATE, formData)
      if (result.ok) {
        toast.success("Property deleted.")
        setOpen(false)
        router.refresh()
      } else if (result.error) {
        toast.error(result.error)
      }
    })
  }

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setConfirmValue("")
      }}
    >
      {!isControlled && (
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant={triggerVariant}
            size={triggerSize}
            className={triggerClassName}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {propertyName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the property. Its pools are NOT deleted —
            they stay and become ungrouped. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="confirm-name">
            Type <span className="font-semibold text-foreground">{propertyName}</span> to confirm
          </Label>
          <Input
            id="confirm-name"
            value={confirmValue}
            onChange={(e) => setConfirmValue(e.target.value)}
            placeholder={propertyName}
            autoComplete="off"
            autoFocus
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!matches || pending}
            onClick={handleSubmit}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
