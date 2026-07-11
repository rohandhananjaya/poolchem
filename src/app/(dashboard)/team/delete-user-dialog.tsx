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
  deleteTeamUserAction,
  type FormState,
} from "./actions"

const INITIAL_STATE: FormState = { ok: false }

export function DeleteUserDialog({
  user,
  open,
  onOpenChange,
}: {
  user: { id: string; name: string; email: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [pending, startTransition] = React.useTransition()

  function handleDelete() {
    const formData = new FormData()
    formData.set("userId", user.id)

    startTransition(async () => {
      const result = await deleteTeamUserAction(INITIAL_STATE, formData)
      if (result.ok) {
        toast.success("User deleted.")
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
          <DialogTitle>Delete {user.name}?</DialogTitle>
          <DialogDescription>
            This permanently removes {user.name} ({user.email}) from the
            company. They will no longer be able to access the app. This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={handleDelete}
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
