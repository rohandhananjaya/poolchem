"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, CreditCard } from "lucide-react"
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
import { createPaymentAction } from "@/app/(dashboard)/account/package/actions"
import { formatPrice, type PackageInfo } from "@/lib/package-features"

interface PayNowDialogProps {
  pkg: PackageInfo
  trigger?: React.ReactNode
  stripeEnabled: boolean
  paypalEnabled: boolean
}

export function PayNowDialog({ pkg, trigger, stripeEnabled, paypalEnabled }: PayNowDialogProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<"choice" | "success" | "error">("choice")
  const [pending, startTransition] = React.useTransition()
  const [errorMsg, setErrorMsg] = React.useState<string>("")

  const hasProviders = stripeEnabled || paypalEnabled
  const singleProvider = stripeEnabled !== paypalEnabled

  async function handlePay(provider?: "stripe" | "paypal") {
    const formData = new FormData()
    formData.set("package", pkg.slug)
    if (provider) formData.set("provider", provider)

    startTransition(async () => {
      const result = await createPaymentAction({ ok: false }, formData)
      if (result.ok && result.redirectUrl) {
        window.location.href = result.redirectUrl
      } else if (result.ok) {
        setStep("success")
        toast.success("Payment successful!")
        router.refresh()
      } else {
        setErrorMsg(result.error ?? "Payment failed.")
        setStep("error")
        toast.error(result.error ?? "Payment failed.")
      }
    })
  }

  function reset() {
    setStep("choice")
    setErrorMsg("")
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
        {trigger ?? (
          <Button size="lg" className="w-full">
            {hasProviders ? `Subscribe ${formatPrice(pkg.price)}` : `Pay ${formatPrice(pkg.price)}`}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        {step === "choice" && (
          <>
            <DialogHeader>
              <DialogTitle>
                {hasProviders ? `Subscribe to ${pkg.name}` : `Pay ${formatPrice(pkg.price)}`}
              </DialogTitle>
              <DialogDescription>
                {hasProviders
                  ? "Choose a payment method to activate your subscription."
                  : "No payment provider is configured for this platform."}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-sm font-medium text-foreground">{pkg.name} Plan</p>
              <p className="text-sm text-muted-foreground">{formatPrice(pkg.price)}/mo</p>
            </div>

            {hasProviders && (
              <div className="space-y-3">
                {singleProvider ? (
                  stripeEnabled ? (
                    <Button
                      className="w-full"
                      size="lg"
                      disabled={pending}
                      onClick={() => handlePay()}
                    >
                      <CreditCard className="mr-2 size-4" />
                      {pending ? "Redirecting…" : "Pay with Card (Stripe)"}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      size="lg"
                      disabled={pending}
                      onClick={() => handlePay()}
                    >
                      <svg className="mr-2 size-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z"/>
                      </svg>
                      {pending ? "Redirecting…" : "Pay with PayPal"}
                    </Button>
                  )
                ) : (
                  <>
                    <Button
                      className="w-full"
                      size="lg"
                      disabled={pending}
                      onClick={() => handlePay("stripe")}
                    >
                      <CreditCard className="mr-2 size-4" />
                      {pending ? "Redirecting…" : "Pay with Card (Stripe)"}
                    </Button>
                    <Button
                      className="w-full"
                      size="lg"
                      variant="outline"
                      disabled={pending}
                      onClick={() => handlePay("paypal")}
                    >
                      <svg className="mr-2 size-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z"/>
                      </svg>
                      {pending ? "Redirecting…" : "Pay with PayPal"}
                    </Button>
                  </>
                )}
              </div>
            )}

            {!hasProviders && (
              <p className="text-sm text-muted-foreground text-center">
                Please contact support to set up a payment method.
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "success" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-500" />
                Payment successful!
              </DialogTitle>
              <DialogDescription>
                Your {pkg.name} plan is now active. You have full access to all included features.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              <p>Amount: {formatPrice(pkg.price)}</p>
              <p>Plan: {pkg.name}</p>
              <p>Status: Active</p>
            </div>
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
                Payment failed
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
