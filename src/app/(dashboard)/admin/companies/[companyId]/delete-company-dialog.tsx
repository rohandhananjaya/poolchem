"use client"

import * as React from "react"
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
  deleteCompanyAction,
  type FormState,
} from "../actions"

const INITIAL_STATE: FormState = { ok: false }

export function DeleteCompanyDialog({
  companyId,
  companyName,
}: {
  companyId: string
  companyName: string
}) {
  const [open, setOpen] = React.useState(false)
  const [confirmValue, setConfirmValue] = React.useState("")
  const [pending, startTransition] = React.useTransition()

  const matches = confirmValue === companyName

  function handleSubmit() {
    if (!matches) return

    const formData = new FormData()
    formData.set("companyId", companyId)
    formData.set("confirmName", companyName)

    startTransition(async () => {
      const result = await deleteCompanyAction(INITIAL_STATE, formData)
      if (result.ok) {
        toast.success("Company deleted.")
        window.location.href = "/admin/companies"
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
        <Button type="button" variant="destructive">
          Delete Company
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {companyName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the company, all of its users, pools,
            service visits, water readings, and chemical logs. This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="confirm-name">
            Type <span className="font-semibold text-foreground">{companyName}</span> to confirm
          </Label>
          <Input
            id="confirm-name"
            value={confirmValue}
            onChange={(e) => setConfirmValue(e.target.value)}
            placeholder={companyName}
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
