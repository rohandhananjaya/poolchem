"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  cancelInvitationAction,
  type FormState,
} from "./actions"

const INITIAL_STATE: FormState = { ok: false }

export function CancelInvitationDialog({
  invitation,
  open,
  onOpenChange,
}: {
  invitation: { id: string; name: string; email: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [pending, startTransition] = React.useTransition()

  function handleCancel() {
    const formData = new FormData()
    formData.set("invitationId", invitation.id)

    startTransition(async () => {
      const result = await cancelInvitationAction(INITIAL_STATE, formData)
      if (result.ok) {
        toast.success("Invitation cancelled.")
        onOpenChange(false)
      } else if (result.error) {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel invitation to {invitation.name}?</DialogTitle>
          <DialogDescription>
            {invitation.email} will no longer be able to use this invitation
            link to join your company. You can invite them again later.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Keep invitation
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={handleCancel}
          >
            {pending ? "Cancelling…" : "Cancel invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
