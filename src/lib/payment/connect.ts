import "server-only"

import { getStripe } from "./stripe"

export interface ConnectAccountStatus {
  chargesEnabled: boolean
  detailsSubmitted: boolean
  payoutsEnabled: boolean
}

export interface ConnectOnboardingLink {
  url: string
  accountId: string
}

/**
 * Ensures a Stripe Express connected account exists for the company (creating
 * one on first call) and returns a fresh onboarding Account Link. Account
 * Links expire quickly and are single-use, so callers must not cache the URL.
 */
export async function createConnectOnboardingLink(
  params: {
    companyEmail: string
    existingAccountId?: string | null
    returnUrl: string
    refreshUrl: string
  },
  devMode?: boolean,
): Promise<ConnectOnboardingLink> {
  const stripe = getStripe(devMode)

  const accountId =
    params.existingAccountId ??
    (
      await stripe.accounts.create({
        type: "express",
        email: params.companyEmail,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      })
    ).id

  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: params.returnUrl,
    refresh_url: params.refreshUrl,
  })

  return { url: link.url, accountId }
}

/** Live onboarding/capability status for a connected account. */
export async function getConnectAccountStatus(
  accountId: string,
  devMode?: boolean,
): Promise<ConnectAccountStatus> {
  const stripe = getStripe(devMode)
  const account = await stripe.accounts.retrieve(accountId)
  return {
    chargesEnabled: account.charges_enabled,
    detailsSubmitted: account.details_submitted,
    payoutsEnabled: account.payouts_enabled,
  }
}

/**
 * Deletes the connected account on Stripe's side. Only valid for accounts the
 * platform created (Express/Custom) — Standard accounts must be deauthorized
 * via OAuth instead, which this app doesn't use.
 */
export async function disconnectConnectAccount(
  accountId: string,
  devMode?: boolean,
): Promise<void> {
  const stripe = getStripe(devMode)
  await stripe.accounts.del(accountId)
}
