"use client"

import * as React from "react"
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
} from "@/components/ui/dialog"
import {
  updateUserAction,
  type FormState,
} from "../actions"

const INITIAL_STATE: FormState = { ok: false }

export function EditUserDialog({
  user,
  companyId,
  open,
  onOpenChange,
}: {
  user: { id: string; name: string; email: string; role: string }
  companyId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [state, action, pending] = React.useActionState(
    updateUserAction,
    INITIAL_STATE,
  )

  React.useEffect(() => {
    if (state.ok) {
      toast.success("User updated.")
      onOpenChange(false)
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={action}>
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="companyId" value={companyId} />

          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              Update {user.name}&apos;s name or role.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                name="name"
                defaultValue={user.name}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-role">Role</Label>
              <select
                id="edit-role"
                name="role"
                defaultValue={user.role}
                className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <option value="OWNER">Owner</option>
                <option value="TECH">Technician</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
