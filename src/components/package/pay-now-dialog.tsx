"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
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
import { payNowAction } from "@/app/(dashboard)/account/package/actions"
import { formatPrice, type PackageInfo } from "@/lib/package-features"

interface PayNowDialogProps {
  pkg: PackageInfo
  trigger?: React.ReactNode
}

export function PayNowDialog({ pkg, trigger }: PayNowDialogProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<"form" | "success">("form")
  const [pending, startTransition] = React.useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set("package", pkg.slug)

    startTransition(async () => {
      const result = await payNowAction({ ok: false }, formData)
      if (result.ok) {
        setStep("success")
        toast.success("Payment successful!")
        router.refresh()
      } else {
        toast.error(result.error ?? "Payment failed.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setStep("form") }}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="lg" className="w-full">Pay {formatPrice(pkg.price)}</Button>}
      </DialogTrigger>
      <DialogContent>
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle>Pay {formatPrice(pkg.price)}</DialogTitle>
              <DialogDescription>
                This is a simulated payment. No real money will be charged.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-sm font-medium text-foreground">{pkg.name} Plan</p>
                <p className="text-sm text-muted-foreground">{formatPrice(pkg.price)}/mo</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="card-number">Card number</Label>
                  <Input
                    id="card-number"
                    name="cardNumber"
                    placeholder="4242 4242 4242 4242"
                    defaultValue="4242 4242 4242 4242"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="expiry">Expiry</Label>
                    <Input id="expiry" name="expiry" placeholder="12/28" defaultValue="12/28" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cvc">CVC</Label>
                    <Input id="cvc" name="cvc" placeholder="123" defaultValue="123" required />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Processing…" : `Pay ${formatPrice(pkg.price)}`}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
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
      </DialogContent>
    </Dialog>
  )
}
