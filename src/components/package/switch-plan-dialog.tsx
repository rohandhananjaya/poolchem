"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowUpCircle, ArrowDownCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { switchPackageAction } from "@/app/(dashboard)/account/package/actions"
import { formatPrice, type PackageInfo } from "@/lib/package-features"

interface SwitchPlanDialogProps {
  pkg: PackageInfo
  currentPrice: number
  currentName: string
}

export function SwitchPlanDialog({ pkg, currentPrice, currentName }: SwitchPlanDialogProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<"confirm" | "success" | "error">("confirm")
  const [pending, startTransition] = React.useTransition()
  const [errorMsg, setErrorMsg] = React.useState<string>("")
  const [effectiveAt, setEffectiveAt] = React.useState<string | null>(null)
  const [prorationAmount, setProrationAmount] = React.useState<number | undefined>(undefined)

  const isUpgrade = pkg.price > currentPrice

  function handleSwitch() {
    const formData = new FormData()
    formData.set("package", pkg.slug)

    startTransition(async () => {
      const result = await switchPackageAction({ ok: false }, formData)
      if (result.ok && result.redirectUrl) {
        // PayPal needs the subscriber to re-approve this change.
        window.location.href = result.redirectUrl
      } else if (result.ok) {
        setEffectiveAt(result.effectiveAt ?? null)
        setProrationAmount(result.prorationAmount)
        setStep("success")
        toast.success(isUpgrade ? "Plan upgraded!" : "Downgrade scheduled.")
        router.refresh()
      } else {
        setErrorMsg(result.error ?? "Could not switch plans.")
        setStep("error")
        toast.error(result.error ?? "Could not switch plans.")
      }
    })
  }

  function reset() {
    setStep("confirm")
    setErrorMsg("")
    setEffectiveAt(null)
    setProrationAmount(undefined)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg" variant={isUpgrade ? "default" : "outline"} className="w-full">
          {isUpgrade ? (
            <ArrowUpCircle className="mr-2 size-4" />
          ) : (
            <ArrowDownCircle className="mr-2 size-4" />
          )}
          {isUpgrade ? `Upgrade to ${pkg.name}` : `Switch to ${pkg.name}`}
        </Button>
      </DialogTrigger>
      <DialogContent>
        {step === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>
                {isUpgrade ? `Upgrade to ${pkg.name}` : `Switch to ${pkg.name}`}
              </DialogTitle>
              <DialogDescription>
                {isUpgrade
                  ? "You'll be charged a prorated amount today, and moved to this plan immediately."
                  : `You'll keep your current ${currentName} features until your paid period ends, then move to ${pkg.name} at ${formatPrice(pkg.price)}/mo.`}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-sm font-medium text-foreground">{pkg.name} Plan</p>
              <p className="text-sm text-muted-foreground">{formatPrice(pkg.price)}/mo</p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSwitch} disabled={pending}>
                {pending ? "Switching…" : "Confirm"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "success" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {isUpgrade ? (
                  <ArrowUpCircle className="size-5 text-emerald-500" />
                ) : (
                  <ArrowDownCircle className="size-5 text-emerald-500" />
                )}
                {isUpgrade ? "Plan upgraded!" : "Downgrade scheduled"}
              </DialogTitle>
              <DialogDescription>
                {isUpgrade
                  ? `Your ${pkg.name} plan is now active.`
                  : `You'll switch to ${pkg.name} on ${effectiveAt ? new Date(effectiveAt).toLocaleDateString() : "your next billing date"}. Your current features stay active until then.`}
              </DialogDescription>
            </DialogHeader>
            {isUpgrade && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                <p>
                  Charged today:{" "}
                  {prorationAmount !== undefined ? formatPrice(prorationAmount) : formatPrice(pkg.price)}
                </p>
                <p>Plan: {pkg.name}</p>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => { setOpen(false); router.refresh() }}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "error" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                Couldn&apos;t switch plans
              </DialogTitle>
              <DialogDescription>{errorMsg}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => reset()}>Try again</Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
