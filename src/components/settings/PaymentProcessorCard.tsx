"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CreditCard, Link2Off } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  connectStripeAction,
  disconnectStripeAction,
  type FormState,
} from "@/app/(dashboard)/settings/actions"

export interface PaymentProcessorCardProps {
  /** Whether a Stripe Express account has been created for this company. */
  connected: boolean
  /** Whether Stripe has finished verifying the account and enabled charges. */
  onboarded: boolean
}

export function PaymentProcessorCard({
  connected,
  onboarded,
}: PaymentProcessorCardProps) {
  const router = useRouter()
  const [disconnectOpen, setDisconnectOpen] = React.useState(false)
  const [disconnecting, startDisconnect] = React.useTransition()

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-card-foreground">
          Payment processor
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Connect a Stripe account to accept card payments from your customers.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <span
          className="inline-flex items-center gap-1.5 text-sm font-medium"
          data-testid="connect-status"
        >
          <span
            className={
              "size-2 shrink-0 rounded-full " +
              (onboarded
                ? "bg-emerald-500"
                : connected
                  ? "bg-amber-500"
                  : "bg-muted-foreground")
            }
          />
          <span
            className={
              onboarded
                ? "text-emerald-600 dark:text-emerald-400"
                : connected
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
            }
          >
            {onboarded
              ? "Connected"
              : connected
                ? "Connection incomplete"
                : "Not connected"}
          </span>
        </span>

        {connected ? (
          <div className="flex flex-wrap gap-2">
            {!onboarded ? (
              <form action={connectStripeAction}>
                <Button type="submit" size="sm">
                  <CreditCard />
                  Finish setup
                </Button>
              </form>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDisconnectOpen(true)}
            >
              <Link2Off />
              Disconnect
            </Button>
          </div>
        ) : (
          <form action={connectStripeAction}>
            <Button type="submit" size="sm">
              <CreditCard />
              Connect Stripe
            </Button>
          </form>
        )}
      </div>

      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect payment processor?</DialogTitle>
            <DialogDescription>
              Your company will no longer be able to accept card payments in-app
              until you reconnect.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={disconnecting}
              onClick={() => setDisconnectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={disconnecting}
              onClick={() =>
                startDisconnect(async () => {
                  const result: FormState = await disconnectStripeAction({ ok: false })
                  if (result.ok) {
                    setDisconnectOpen(false)
                    toast.success("Payment processor disconnected.")
                    router.refresh()
                  } else if (result.error) {
                    toast.error(result.error)
                  }
                })
              }
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
