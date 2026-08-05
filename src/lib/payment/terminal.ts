import "server-only";

/**
 * Card-present capture boundary (Epic 1: Payments-as-a-Service).
 *
 * A technician taps/swipes a customer's card at the equipment pad. Real
 * capture will run through Stripe Terminal on the company's connected
 * account; until a physical reader is wired up, `mockCardPresentProvider`
 * stands in — it "captures" instantly and returns a synthetic reference.
 *
 * Server Actions depend on the `CardPresentProvider` interface, never on a
 * concrete implementation, so the Stripe Terminal provider can drop in later
 * without touching callers.
 */

export interface CardPresentChargeParams {
  /** Amount to charge the customer, in cents. */
  amountCents: number;
  /** Human-readable description shown on the receipt. */
  description: string;
  /** The company's Stripe Connect account that collects the funds. */
  connectedAccountId: string | null;
}

export interface CardPresentChargeResult {
  /** Opaque processor reference (payment intent id once Stripe Terminal lands). */
  providerReference: string;
  /** How the capture was performed — lets callers label dev charges. */
  captureMethod: "simulated" | "reader";
}

export interface CardPresentProvider {
  captureCharge(params: CardPresentChargeParams): Promise<CardPresentChargeResult>;
}

/** Dev/no-reader stand-in, mirroring `simulateTransaction`. */
export const mockCardPresentProvider: CardPresentProvider = {
  async captureCharge(params: CardPresentChargeParams): Promise<CardPresentChargeResult> {
    if (!Number.isFinite(params.amountCents) || params.amountCents <= 0) {
      throw new Error("Charge amount must be a positive number of cents.");
    }
    return {
      providerReference: `sim_${Date.now()}`,
      captureMethod: "simulated",
    };
  },
};

/** Resolves the active provider. Real Stripe Terminal plugs in here. */
export function getCardPresentProvider(): CardPresentProvider {
  return mockCardPresentProvider;
}
