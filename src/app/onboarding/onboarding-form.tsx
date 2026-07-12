"use client"

import * as React from "react"
import { toast } from "sonner"
import { Building2, CheckCircle2, Waves } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateCompanyDetailsAction, createFirstPoolAction } from "./actions"

export function OnboardingForm({
  company,
  hasPools,
  poolsCount,
}: {
  company: { hasPhoneOrAddress: boolean; phone: string | null; address: string | null }
  hasPools: boolean
  poolsCount: number
}) {
  const [companyPending, startCompanyTransition] = React.useTransition()
  const [poolPending, startPoolTransition] = React.useTransition()

  async function handleCompanySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    startCompanyTransition(async () => {
      const result = await updateCompanyDetailsAction({ ok: false }, formData)
      if (result.ok) {
        toast.success("Company details saved.")
      } else {
        toast.error(result.error ?? "Something went wrong.")
      }
    })
  }

  async function handlePoolSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    startPoolTransition(async () => {
      const result = await createFirstPoolAction({ ok: false }, formData)
      if (result.ok) {
        toast.success("Pool created!")
        // Reset the form – the page will show the updated count on next refresh.
        form.reset()
      } else {
        toast.error(result.error ?? "Something went wrong.")
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Company details */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Company details</h2>
          {company.hasPhoneOrAddress ? (
            <CheckCircle2 className="size-4 text-emerald-500 ml-auto" />
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Optional contact info for your company profile.
        </p>

        <form onSubmit={handleCompanySubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="(555) 123-4567"
              defaultValue={company.phone ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              name="address"
              placeholder="123 Main St, City, State"
              defaultValue={company.address ?? ""}
            />
          </div>
          <Button type="submit" size="sm" disabled={companyPending}>
            {companyPending ? "Saving…" : "Save details"}
          </Button>
        </form>
      </div>

      {/* Create first pool */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-1">
          <Waves className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">First pool</h2>
          {hasPools ? (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-auto font-medium">
              {poolsCount} pool{poolsCount !== 1 ? "s" : ""} added
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Add a pool to get started. You can add more later.
        </p>

        <form onSubmit={handlePoolSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pool-name">Pool name</Label>
            <Input
              id="pool-name"
              name="name"
              placeholder="e.g. Johnson Residence"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pool-volume">Volume (gallons)</Label>
            <Input
              id="pool-volume"
              name="volume"
              type="number"
              min="1"
              placeholder="e.g. 20000"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pool-address">Address (optional)</Label>
            <Input
              id="pool-address"
              name="address"
              placeholder="123 Main St, City, State"
            />
          </div>
          <Button type="submit" size="sm" disabled={poolPending}>
            {poolPending ? "Creating…" : "Add pool"}
          </Button>
        </form>
      </div>
    </div>
  )
}
