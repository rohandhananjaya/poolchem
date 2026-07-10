"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  updateCompanyAction,
  type FormState,
} from "../actions"
import { DeleteCompanyDialog } from "./delete-company-dialog"

const INITIAL_STATE: FormState = { ok: false }

const SUBSCRIPTION_OPTIONS = [
  { value: "", label: "No subscription" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past due" },
  { value: "canceled", label: "Canceled" },
  { value: "trialing", label: "Trialing" },
  { value: "incomplete", label: "Incomplete" },
  { value: "unpaid", label: "Unpaid" },
] as const

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

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  )
}

export interface CompanyEditFormProps {
  company: {
    id: string
    name: string
    email: string
    phone: string | null
    address: string | null
    active: boolean
    subscriptionStatus: string | null
    stripeCustomerId: string | null
    stripeSubscriptionId: string | null
    createdAt: Date
    _count: { users: number; pools: number }
  }
}

export function CompanyEditForm({ company }: CompanyEditFormProps) {
  const [state, action, pending] = React.useActionState(
    updateCompanyAction,
    INITIAL_STATE,
  )

  React.useEffect(() => {
    if (state.ok) toast.success("Company updated.")
    else if (state.error) toast.error(state.error)
  }, [state])

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-6">
        <input type="hidden" name="companyId" value={company.id} />

        <Card title="General">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Company name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={company.name}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={company.email}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={company.phone ?? ""}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                defaultValue={company.address ?? ""}
              />
            </div>
          </div>
        </Card>

        <Card title="Subscription">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="subscriptionStatus">Status</Label>
              <select
                id="subscriptionStatus"
                name="subscriptionStatus"
                defaultValue={company.subscriptionStatus ?? ""}
                className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {SUBSCRIPTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="active">Active</Label>
              <select
                id="active"
                name="active"
                defaultValue={company.active ? "on" : "off"}
                className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <option value="on">Active</option>
                <option value="off">Inactive</option>
              </select>
            </div>
          </div>
        </Card>

        <Card title="Stripe info">
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlyField
              label="Customer ID"
              value={company.stripeCustomerId ?? "—"}
            />
            <ReadOnlyField
              label="Subscription ID"
              value={company.stripeSubscriptionId ?? "—"}
            />
            <ReadOnlyField
              label="Created"
              value={company.createdAt.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            />
            <ReadOnlyField
              label="Users / Pools"
              value={`${company._count.users} users · ${company._count.pools} pools`}
            />
          </div>
        </Card>

        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 md:p-6">
          <header className="mb-4">
            <h2 className="text-base font-semibold text-destructive">
              Danger Zone
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Irreversible actions that affect the entire company.
            </p>
          </header>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Delete this company
              </p>
              <p className="text-xs text-muted-foreground">
                Permanently removes {company.name} and all associated data.
              </p>
            </div>
            <DeleteCompanyDialog
              companyId={company.id}
              companyName={company.name}
            />
          </div>
        </section>

        <div className="flex gap-3">
          <SaveButton pending={pending} />
          {state.ok && (
            <p className="text-sm text-emerald-600">Saved successfully.</p>
          )}
        </div>
      </form>
    </div>
  )
}
