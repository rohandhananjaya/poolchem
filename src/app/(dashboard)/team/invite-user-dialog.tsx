"use client"

import * as React from "react"
import { toast } from "sonner"
import { Copy, Mail } from "lucide-react"

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
import { inviteTeamUserAction, type FormState } from "./actions"

const INITIAL_STATE: FormState = { ok: false }

export function InviteUserDialog() {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null)

  function action(formData: FormData) {
    startTransition(async () => {
      const state = await inviteTeamUserAction(INITIAL_STATE, formData)
      if (state.ok && state.inviteUrl) {
        setInviteUrl(state.inviteUrl)
        toast.success("Invitation created!")
      } else if (state.error) {
        toast.error(state.error)
      }
    })
  }

  function handleCopy() {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl)
      toast.success("Invite link copied!")
    }
  }

  function handleDialogClose(open: boolean) {
    setOpen(open)
    if (!open) {
      setInviteUrl(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Mail className="size-4" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        {inviteUrl ? (
          <>
            <DialogHeader>
              <DialogTitle>Invitation created</DialogTitle>
              <DialogDescription>
                Share this link with the user so they can set their own password.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <div className="flex items-center gap-2">
                <Input readOnly value={inviteUrl} className="text-xs" />
                <Button type="button" size="icon" variant="outline" onClick={handleCopy}>
                  <Copy className="size-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This link expires in 7 days.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => handleDialogClose(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form action={action}>
            <DialogHeader>
              <DialogTitle>Invite a team member</DialogTitle>
              <DialogDescription>
                They&apos;ll receive a link to set their own password.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-1.5">
                <Label htmlFor="invite-name">Name</Label>
                <Input id="invite-name" name="name" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="invite-email">Email</Label>
                <Input id="invite-email" name="email" type="email" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  name="role"
                  defaultValue="TECH"
                  className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  required
                >
                  <option value="OWNER">Owner</option>
                  <option value="TECH">Technician</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create invitation"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
