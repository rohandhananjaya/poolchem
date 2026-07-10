"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  updateAccountAction,
  updateCompanyAction,
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
  }
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

  const [accountState, accountAction, accountPending] = React.useActionState(
    updateAccountAction,
    INITIAL_STATE,
  )
  const [companyState, companyAction, companyPending] = React.useActionState(
    updateCompanyAction,
    INITIAL_STATE,
  )

  useFormFeedback(accountState, "Account updated.")
  useFormFeedback(companyState, "Company details updated.")

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
      <Card title="Account" description="Your personal details.">
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
      </Card>

      {/* Company */}
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

      {/* Sign out */}
      <div>
        <Button
          type="button"
          variant="destructive"
          size="lg"
          disabled={signingOut}
          onClick={handleSignOut}
        >
          <LogOut />
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </div>
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
  return role === "OWNER" ? "Owner" : "Technician"
}
