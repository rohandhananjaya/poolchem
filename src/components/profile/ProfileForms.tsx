"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Download, LogOut, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  updateAccountAction,
  updateCompanyAction,
  updatePasswordAction,
  deleteAccountAction,
  exportDataAction,
  type FormState,
} from "@/app/(dashboard)/profile/actions"

const INITIAL_STATE: FormState = { ok: false }

/** Card wrapper matching the app's inline card styling. */
function Card({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-card-foreground">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  )
}

/** Submit button that reflects the surrounding form's pending state. */
function SaveButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  )
}

/** A labelled read-only field (for values that can't be edited here). */
function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  )
}

export interface ProfileFormsProps {
  account: { name: string; email: string; role: string }
  company: {
    name: string
    email: string
    phone: string | null
    address: string | null
  } | null
  /** Whether the signed-in user may edit company details. */
  canEditCompany: boolean
}

export function ProfileForms({
  account,
  company,
  canEditCompany,
}: ProfileFormsProps) {
  const router = useRouter()
  const [signingOut, setSigningOut] = React.useState(false)
  const [exporting, startExport] = React.useTransition()
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, startDelete] = React.useTransition()

  const [accountState, accountAction, accountPending] = React.useActionState(
    updateAccountAction,
    INITIAL_STATE,
  )
  const [companyState, companyAction, companyPending] = React.useActionState(
    updateCompanyAction,
    INITIAL_STATE,
  )
  const [passwordState, passwordAction, passwordPending] = React.useActionState(
    updatePasswordAction,
    INITIAL_STATE,
  )

  useFormFeedback(accountState, "Account updated.")
  useFormFeedback(companyState, "Company details updated.")
  useFormFeedback(passwordState, "Password updated.")

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Account */}
      <Card title="Account">
        <Tabs defaultValue="personal">
          <TabsList>
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="password">Change Password</TabsTrigger>
          </TabsList>
          <TabsContent value="personal">
            <form action={accountAction} className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="account-name">Name</Label>
                <Input
                  id="account-name"
                  name="name"
                  defaultValue={account.name}
                  required
                  autoComplete="name"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <ReadOnlyField label="Email" value={account.email} />
                <ReadOnlyField label="Role" value={roleLabel(account.role)} />
              </div>
              <div>
                <SaveButton pending={accountPending} />
              </div>
            </form>
          </TabsContent>
          <TabsContent value="password">
            <form action={passwordAction} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="current-password">Current password</Label>
                  <PasswordInput
                    id="current-password"
                    name="currentPassword"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-password">New password</Label>
                  <PasswordInput
                    id="new-password"
                    name="newPassword"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <PasswordInput
                    id="confirm-password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
              <div>
                <SaveButton pending={passwordPending} />
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Company */}
      {company ? (
        <Card
          title="Company"
          description={
            canEditCompany
              ? "Details shown on service reports."
              : "Only company owners can edit these details."
          }
        >
          {canEditCompany ? (
            <form action={companyAction} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="company-name">Company name</Label>
                  <Input
                    id="company-name"
                    name="name"
                    defaultValue={company.name}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="company-email">Email</Label>
                  <Input
                    id="company-email"
                    name="email"
                    type="email"
                    defaultValue={company.email}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="company-phone">Phone</Label>
                  <Input
                    id="company-phone"
                    name="phone"
                    type="tel"
                    defaultValue={company.phone ?? ""}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="company-address">Address</Label>
                  <Input
                    id="company-address"
                    name="address"
                    defaultValue={company.address ?? ""}
                  />
                </div>
              </div>
              <div>
                <SaveButton pending={companyPending} />
              </div>
            </form>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <ReadOnlyField label="Company name" value={company.name} />
              <ReadOnlyField label="Email" value={company.email} />
              <ReadOnlyField label="Phone" value={company.phone ?? "—"} />
              <ReadOnlyField label="Address" value={company.address ?? "—"} />
            </div>
          )}
        </Card>
      ) : null}

      {/* GDPR: data privacy controls */}
      <Card
        title="Data & Privacy"
        description="Manage your personal data under GDPR."
      >
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={exporting}
            onClick={() =>
              startExport(async () => {
                const result = await exportDataAction()
                if (result.ok && result.data) {
                  const blob = new Blob(
                    [JSON.stringify(result.data, null, 2)],
                    { type: "application/json" },
                  )
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = `poolchem-export-${new Date().toISOString().slice(0, 10)}.json`
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                  URL.revokeObjectURL(url)
                  toast.success("Your data has been downloaded.")
                } else if (result.error) {
                  toast.error(result.error)
                }
              })
            }
          >
            <Download />
            {exporting ? "Exporting…" : "Export my data"}
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="lg"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 />
            Delete account
          </Button>
        </div>
      </Card>

      {/* Sign out */}
      <div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={signingOut}
          onClick={handleSignOut}
        >
          <LogOut />
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </div>

      {/* Delete account confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently removes your account and all associated personal
              data from PoolChem. You will no longer be able to access the app.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() =>
                startDelete(async () => {
                  const result = await deleteAccountAction({ ok: false })
                  if (result.ok) {
                    setDeleteOpen(false)
                    toast.success("Your account has been deleted.")
                    const supabase = createClient()
                    await supabase.auth.signOut()
                    router.push("/login")
                    router.refresh()
                  } else if (result.error) {
                    toast.error(result.error)
                  }
                })
              }
            >
              {deleting ? "Deleting…" : "Delete my account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Toasts once whenever a form action resolves to success or error. */
function useFormFeedback(state: FormState, successMessage: string) {
  React.useEffect(() => {
    if (state.ok) toast.success(successMessage)
    else if (state.error) toast.error(state.error)
    // Re-run when the action returns a new state object.
  }, [state, successMessage])
}

/** Human-friendly label for a role enum value. */
function roleLabel(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Platform Administrator"
    case "OWNER":
      return "Owner"
    default:
      return "Technician"
  }
}
