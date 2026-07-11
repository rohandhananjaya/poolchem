"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
  deletePoolAction,
  type FormState,
} from "@/app/(dashboard)/pools/actions"

const INITIAL_STATE: FormState = { ok: false }

interface DeletePoolDialogProps {
  poolId: string
  poolName: string
}

export function DeletePoolDialog({ poolId, poolName }: DeletePoolDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [confirmValue, setConfirmValue] = React.useState("")
  const [pending, startTransition] = React.useTransition()
  const router = useRouter()

  const matches = confirmValue === poolName

  function handleSubmit() {
    if (!matches) return

    const formData = new FormData()
    formData.set("poolId", poolId)
    formData.set("confirmName", poolName)

    startTransition(async () => {
      const result = await deletePoolAction(INITIAL_STATE, formData)
      if (result.ok) {
        toast.success("Pool deleted.")
        setOpen(false)
        router.refresh()
      } else if (result.error) {
        toast.error(result.error)
      }
    })
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setConfirmValue("")
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="w-full justify-start text-destructive">
          <Trash2 className="size-4" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {poolName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the pool, all of its service visits, water
            readings, and chemical logs. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="confirm-name">
            Type <span className="font-semibold text-foreground">{poolName}</span> to confirm
          </Label>
          <Input
            id="confirm-name"
            value={confirmValue}
            onChange={(e) => setConfirmValue(e.target.value)}
            placeholder={poolName}
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
