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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  createUserAction,
  type FormState,
} from "../actions"

const INITIAL_STATE: FormState = { ok: false }

export function CreateUserDialog({ companyId }: { companyId: string }) {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  function action(formData: FormData) {
    startTransition(async () => {
      const state = await createUserAction(INITIAL_STATE, formData)
      if (state.ok) {
        toast.success("User created.")
        setOpen(false)
      } else if (state.error) {
        toast.error(state.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <span className="mr-1">+</span>
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={action}>
          <input type="hidden" name="companyId" value={companyId} />

          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              Create a new user account for this company.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="create-name">Name</Label>
              <Input id="create-name" name="name" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                name="email"
                type="email"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="create-role">Role</Label>
              <select
                id="create-role"
                name="role"
                defaultValue="TECH"
                className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                required
              >
                <option value="OWNER">Owner</option>
                <option value="TECH">Technician</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="create-password">Password</Label>
              <Input
                id="create-password"
                name="password"
                type="password"
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                At least 6 characters.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
