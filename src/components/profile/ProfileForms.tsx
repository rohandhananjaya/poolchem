"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, CreditCard, Download, LogOut, Trash2, Upload, X } from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { validateLogoFile } from "@/lib/storage/logo-validation"
import { Button } from "@/components/ui/button"
import { UpgradeDialog } from "@/components/upgrade-dialog"
import { PackageBadge } from "@/components/package/package-badge"
import {
  FEATURE_LABELS,
  formatFeatureValue,
  isTrialExpired,
  type CompanyPackageInfo,
} from "@/lib/package-features"
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
} from "@/app/(dashboard)/settings/actions"

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

/** Current plan summary + link to the plans page, shown in the Manage plan tab. */
function CompanyPlanTab({
  companyPackage,
}: {
  companyPackage?: CompanyPackageInfo | null
}) {
  if (!companyPackage) {
    return (
      <p className="text-sm text-muted-foreground">
        No plan information available.
      </p>
    )
  }

  const expired = isTrialExpired(companyPackage)
  const onTrial = companyPackage.status === "TRIAL" && !expired
  const planName = onTrial
    ? "Free Trial"
    : (companyPackage.package?.name ?? "Free Trial")

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-semibold text-foreground">{planName}</h3>
        <PackageBadge companyPackage={companyPackage} />
      </div>

      {companyPackage.status === "TRIAL" && companyPackage.trialEnd && (
        <p className="text-sm text-muted-foreground">
          {expired
            ? "Your trial has ended."
            : `Trial ends ${companyPackage.trialEnd.toLocaleDateString()}`}
        </p>
      )}

      {onTrial ? (
        <p className="text-sm text-muted-foreground">
          All features are unlocked during your trial. Choose a plan to continue
          after it ends.
        </p>
      ) : companyPackage.package ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FEATURE_LABELS.map(({ key, label }) => {
            const rawValue = companyPackage.package!.features[key]
            const displayValue = formatFeatureValue(rawValue)
            return (
              <li key={key} className="flex items-center gap-2 text-sm">
                {rawValue !== false && rawValue !== 0 ? (
                  <Check className="size-4 shrink-0 text-emerald-500" />
                ) : (
                  <X className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="text-foreground">
                  {label}
                  {typeof displayValue === "string" && (
                    <span className="ml-1 text-muted-foreground">
                      {displayValue}
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}

      <div>
        <Button asChild>
          <Link href="/account/package">
            <CreditCard />
            Manage plan
          </Link>
        </Button>
      </div>
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
    logo: string | null
  } | null
  /** Whether the signed-in user may edit company details. */
  canEditCompany: boolean
  /** Whether the company's plan includes the custom_branding feature. */
  canEditBranding: boolean
  /** The company's current plan/trial state, shown in the Manage plan tab. */
  companyPackage?: CompanyPackageInfo | null
}

export function ProfileForms({
  account,
  company,
  canEditCompany,
  canEditBranding,
  companyPackage,
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

  const [logoPreview, setLogoPreview] = React.useState<string | null>(
    company?.logo ?? null,
  )
  const [removeLogo, setRemoveLogo] = React.useState(false)
  const logoInputRef = React.useRef<HTMLInputElement>(null)

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const validation = validateLogoFile(file)
    if (!validation.ok) {
      toast.error(validation.error)
      event.target.value = ""
      return
    }
    setRemoveLogo(false)
    setLogoPreview(URL.createObjectURL(file))
  }

  function handleRemoveLogo() {
    setRemoveLogo(true)
    setLogoPreview(null)
    if (logoInputRef.current) logoInputRef.current.value = ""
  }

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
      {/* Profile */}
      <section id="profile">
      <Card title="Profile">
        <Tabs defaultValue="personal">
          <TabsList>
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="password">Change Password</TabsTrigger>
            <TabsTrigger value="privacy">Data & Privacy</TabsTrigger>
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
          <TabsContent value="privacy">
            <p className="mb-4 text-sm text-muted-foreground">
              Manage your personal data under GDPR.
            </p>
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
                      a.download = `poolbench-export-${new Date().toISOString().slice(0, 10)}.json`
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
          </TabsContent>
        </Tabs>
      </Card>
      </section>

      {/* Company */}
      {company ? (
        <Card
          title="Company"
          description={
            canEditCompany
              ? "Manage your company details and plan."
              : "Only company owners can edit these details."
          }
        >
          {canEditCompany ? (
            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">Company data</TabsTrigger>
                <TabsTrigger value="plan">Your plan</TabsTrigger>
              </TabsList>
              <TabsContent value="details">
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

                  {canEditBranding ? (
                    <div className="grid gap-1.5">
                      <Label htmlFor="company-logo">Logo</Label>
                      <input
                        type="hidden"
                        name="currentLogo"
                        value={company.logo ?? ""}
                      />
                      <input
                        type="hidden"
                        name="removeLogo"
                        value={removeLogo ? "true" : "false"}
                      />
                      <div className="flex items-center gap-3">
                        {logoPreview ? (
                          // Local blob URL or an existing (possibly external) URL —
                          // next/image can't reliably handle either at this size/scope.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={logoPreview}
                            alt=""
                            data-testid="logo-preview"
                            className="size-12 shrink-0 rounded-xl border border-border object-cover"
                          />
                        ) : (
                          <div
                            data-testid="logo-placeholder"
                            className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-border bg-muted text-muted-foreground"
                          >
                            <Upload className="size-4" />
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" variant="outline" size="sm" asChild>
                            <label htmlFor="company-logo" className="cursor-pointer">
                              {logoPreview ? "Change logo" : "Upload logo"}
                            </label>
                          </Button>
                          {logoPreview ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleRemoveLogo}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <input
                        ref={logoInputRef}
                        id="company-logo"
                        name="logo"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleLogoChange}
                        data-testid="logo-file-input"
                        className="sr-only"
                      />
                      <p className="text-xs text-muted-foreground">
                        PNG, JPEG, or WebP, up to 2MB. Shown on service reports and your
                        homeowner pages.
                      </p>
                    </div>
                  ) : (
                    <UpgradeDialog featureName="Custom branding" buttonLabel="Logo" />
                  )}

                  <div className="flex flex-wrap items-center gap-4">
                    <SaveButton pending={companyPending} />
                    <a
                      href="/account/api-keys"
                      className="text-sm font-medium text-foreground underline underline-offset-2 hover:text-muted-foreground"
                    >
                      Manage API keys
                    </a>
                  </div>
                </form>
              </TabsContent>
              <TabsContent value="plan">
                <CompanyPlanTab companyPackage={companyPackage} />
              </TabsContent>
            </Tabs>
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
              data from Poolbench. You will no longer be able to access the app.
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
