"use client"

import * as React from "react"
import { Receipt } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  simulateTransactionAction,
  type TransactionSimulationState,
} from "@/app/(dashboard)/settings/actions"
import type { PaymentTransactionInfo } from "@/lib/db/payment-transactions"
import { formatFeePercent, formatPrice } from "@/lib/package-features"

export interface BillingCardProps {
  /** Company is on fee-per-transaction billing (no subscription). */
  feeBased: boolean
  /** Platform processing fee, basis points (250 = 2.5%). */
  feePercent: number
  transactions: PaymentTransactionInfo[]
  /** Dev stand-in capture enabled (paymentDevMode on). */
  canSimulate: boolean
}

const STATUS_LABEL: Record<PaymentTransactionInfo["status"], string> = {
  PENDING: "Pending",
  PAID: "Paid",
  REFUNDED: "Refunded",
  FAILED: "Failed",
}

function TransactionRow({ t }: { t: PaymentTransactionInfo }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-card-foreground">{formatPrice(t.amount)}</p>
        <p className="text-xs text-muted-foreground">
          {t.createdAt.toLocaleString()} · {formatFeePercent(t.feePercent)} fee
        </p>
      </div>
      <span className="text-sm text-muted-foreground">+{formatPrice(t.feeAmount)}</span>
      <span className="text-xs font-medium text-muted-foreground">{STATUS_LABEL[t.status]}</span>
    </li>
  )
}

export function BillingCard({
  feeBased,
  feePercent,
  transactions,
  canSimulate,
}: BillingCardProps) {
  const [state, formAction, pending] = React.useActionState<TransactionSimulationState, FormData>(
    simulateTransactionAction,
    { ok: false },
  )

  React.useEffect(() => {
    if (state.ok) {
      toast.success("Simulated payment captured.")
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state])

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-card-foreground">Billing</h2>
        {feeBased ? (
          <p className="mt-0.5 text-sm text-muted-foreground">
            You pay a flat <strong>{formatFeePercent(feePercent)}</strong> per card payment —
            no monthly subscription.
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-muted-foreground">
            You&apos;re billed on a monthly subscription plan.
          </p>
        )}
      </header>

      <div className="mb-3 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 text-sm font-medium"
          data-testid="billing-mode"
        >
          <span
            className={
              "size-2 shrink-0 rounded-full " + (feeBased ? "bg-emerald-500" : "bg-amber-500")
            }
          />
          <span
            className={
              feeBased
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            }
          >
            {feeBased ? "Fee per transaction" : "Subscription"}
          </span>
        </span>
      </div>

      {transactions.length > 0 ? (
        <div className="mb-4">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Receipt className="size-3.5" />
            Recent payments
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {transactions.map((t) => (
              <TransactionRow key={t.id} t={t} />
            ))}
          </ul>
        </div>
      ) : null}

      {canSimulate ? (
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="simulate-amount" className="mb-1 block text-xs font-medium text-muted-foreground">
              Simulate a card payment (dev)
            </label>
            <Input
              id="simulate-amount"
              name="amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              className="w-32"
            />
          </div>
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {pending ? "Capturing…" : "Capture"}
          </Button>
        </form>
      ) : null}
    </section>
  )
}
