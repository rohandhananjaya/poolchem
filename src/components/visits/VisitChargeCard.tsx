"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { chargeVisitAction } from "@/app/(dashboard)/visits/[visitId]/actions";

interface VisitChargeCardProps {
  visitId: string;
  poolName: string;
  paid: boolean;
  readOnly: boolean;
}

/**
 * Charges a customer's card for a visit at the equipment pad (Epic 1:
 * Payments-as-a-Service). Records the visit payment, marks the visit paid, and
 * emails a receipt. Behind the scenes this uses the card-present provider's
 * dev mock until a Stripe Terminal reader is wired.
 */
export function VisitChargeCard({
  visitId,
  poolName,
  paid,
  readOnly,
}: VisitChargeCardProps) {
  const [amount, setAmount] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleCharge = () => {
    const dollars = Number.parseFloat(amount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      toast.error("Enter an amount greater than zero.");
      return;
    }
    const cents = Math.round(dollars * 100);
    startTransition(async () => {
      try {
        const result = await chargeVisitAction(visitId, cents);
        toast.success(
          result.captureMethod === "simulated"
            ? "Payment captured (simulated) — receipt sent"
            : "Payment captured — receipt sent",
        );
        setAmount("");
      } catch (e) {
        console.error("Charge failed:", e);
        toast.error(e instanceof Error ? e.message : "Payment failed.");
      }
    });
  };

  if (paid) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-500" />
          <h2 className="text-sm font-semibold text-card-foreground">
            Payment collected
          </h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          This visit&apos;s card payment has been captured for {poolName}.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <CreditCard className="size-4" />
        <h2 className="text-sm font-semibold text-card-foreground">
          Charge card
        </h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Collect payment for {poolName} by tapping the customer&apos;s card at
        the pad.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
            $
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={readOnly}
            className="block w-full rounded-lg border border-input bg-background pl-7 pr-3 py-2 text-sm font-mono tabular-nums text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <Button
          type="button"
          size="lg"
          className="bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
          onClick={handleCharge}
          disabled={readOnly || isPending}
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Charge
        </Button>
      </div>
      {readOnly && (
        <p className="mt-2 text-xs text-muted-foreground">
          This visit is in progress by another tech.
        </p>
      )}
    </div>
  );
}