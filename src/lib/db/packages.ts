import "server-only"

import type { Package, CompanyPackage, Invoice, Company } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { getPlatformSettings } from "@/lib/db/platform-settings"
import { getPaymentSettings } from "@/lib/db/payment-settings"
import { getCompanyById } from "@/lib/db/company"
import { getProvider } from "@/lib/payment"
import type { PaymentProviderName } from "@/lib/payment/types"
import { logger } from "@/lib/log"
import {
  parseFeatures,
  type PackageInfo,
  type CompanyPackageInfo,
} from "@/lib/package-features"
import { notifyTrialExpired, notifyTrialExpiring } from "@/lib/email/notify"

export type { PackageInfo, CompanyPackageInfo }

function toPackageInfo(pkg: Package): PackageInfo {
  return {
    id: pkg.id,
    slug: pkg.slug,
    name: pkg.name,
    price: pkg.price,
    features: parseFeatures(pkg.features),
    sortOrder: pkg.sortOrder,
  }
}

type CompanyPackageWithRelations = CompanyPackage & {
  package: Package | null
  pendingPackage?: Package | null
}

export function toCompanyPackageInfo(
  cp: CompanyPackageWithRelations,
): CompanyPackageInfo {
  return {
    package: cp.package ? toPackageInfo(cp.package) : null,
    status: cp.status,
    trialStart: cp.trialStart,
    trialEnd: cp.trialEnd,
    paidAt: cp.paidAt,
    pendingPackage: cp.pendingPackage ? toPackageInfo(cp.pendingPackage) : null,
    pendingEffectiveAt: cp.pendingEffectiveAt ?? null,
  }
}

/** Which provider a company's current live subscription belongs to, if any. */
function detectActiveProvider(company: Company): PaymentProviderName | null {
  if (company.stripeSubscriptionId) return "stripe"
  if (company.paypalSubscriptionId) return "paypal"
  return null
}

/**
 * Returns a package's cached, reusable provider plan/price ref, creating and
 * persisting it on first use. Needed because "revise this subscription to
 * plan X" requires a stable target — unlike a first-time checkout, which may
 * create an ephemeral one.
 */
async function ensureProviderPlanRef(
  pkg: Package,
  providerName: PaymentProviderName,
  devMode: boolean,
): Promise<string> {
  const cached = providerName === "stripe" ? pkg.stripePriceId : pkg.paypalPlanId
  if (cached) return cached

  const planRef = await (await getProvider(providerName)).createPlanRef(
    { slug: pkg.slug, name: pkg.name, price: pkg.price },
    devMode,
  )

  await prisma.package.update({
    where: { id: pkg.id },
    data: providerName === "stripe" ? { stripePriceId: planRef } : { paypalPlanId: planRef },
  })

  return planRef
}

/**
 * Resolves the plan ref a first-time PayPal checkout should use, so the new
 * subscription is pinned to the exact same plan (and PayPal product) that
 * upgrade/downgrade calls will later revise against — PayPal's revise API
 * rejects moving a subscription onto a plan under a different product, so an
 * ad-hoc plan created fresh per-checkout would silently break that later.
 * Stripe has no such constraint, so its checkout still prices inline.
 */
export async function getCheckoutPlanRef(
  packageSlug: string,
  providerName: PaymentProviderName,
  devMode: boolean,
): Promise<string | undefined> {
  if (providerName !== "paypal") return undefined
  const pkg = await prisma.package.findUnique({ where: { slug: packageSlug } })
  if (!pkg) throw new Error(`Package "${packageSlug}" not found.`)
  return ensureProviderPlanRef(pkg, providerName, devMode)
}

export async function getAllPackages(): Promise<PackageInfo[]> {
  const packages = await prisma.package.findMany({
    orderBy: { sortOrder: "asc" },
  })
  return packages.map(toPackageInfo)
}

export async function getPackageBySlug(slug: string): Promise<PackageInfo | null> {
  const pkg = await prisma.package.findUnique({ where: { slug } })
  return pkg ? toPackageInfo(pkg) : null
}

export async function getPackageById(id: string): Promise<PackageInfo | null> {
  const pkg = await prisma.package.findUnique({ where: { id } })
  return pkg ? toPackageInfo(pkg) : null
}

export async function getCompanyPackage(
  companyId: string,
): Promise<CompanyPackageInfo | null> {
  const cp = await prisma.companyPackage.findUnique({
    where: { companyId },
    include: { package: true, pendingPackage: true },
  })
  if (!cp) return null

  // Auto-expire trial if past trial end date
  if (
    cp.status === "TRIAL" &&
    cp.trialEnd &&
    new Date() > cp.trialEnd
  ) {
    const updated = await prisma.companyPackage.update({
      where: { companyId },
      data: { status: "EXPIRED" },
      include: { package: true, pendingPackage: true },
    })
    return toCompanyPackageInfo(updated)
  }

  // Lazily apply a scheduled downgrade once its effective date has passed —
  // same idiom as the trial auto-expire above, since this app has no cron.
  if (
    cp.status === "ACTIVE" &&
    cp.pendingPackageId &&
    cp.pendingEffectiveAt &&
    new Date() > cp.pendingEffectiveAt
  ) {
    return applyDuePendingDowngrade(cp)
  }

  return toCompanyPackageInfo(cp)
}

/**
 * Applies a downgrade whose effective date has arrived. Stripe's subscription
 * item was already revised (inertly) at schedule time, so only our own state
 * needs flipping there. PayPal has no clean "apply later" primitive, so its
 * `reviseSubscription` call happens here instead, for the first time.
 *
 * On provider failure, state is left completely untouched (old plan stays
 * active, pending fields stay set) so the next read simply retries — never
 * partially corrupt the company's package state.
 */
async function applyDuePendingDowngrade(
  cp: CompanyPackage & { package: Package | null; pendingPackage: Package | null },
): Promise<CompanyPackageInfo> {
  if (!cp.pendingPackage) {
    // Dangling pending fields — shouldn't happen given onDelete: Restrict, but
    // don't get stuck retrying forever against a target that no longer exists.
    logger.error("Pending downgrade target package is missing — clearing.", {
      context: "packages.applyDuePendingDowngrade",
      companyId: cp.companyId,
      metadata: { pendingPackageId: cp.pendingPackageId },
    })
    const cleared = await prisma.companyPackage.update({
      where: { companyId: cp.companyId },
      data: { pendingPackageId: null, pendingEffectiveAt: null },
      include: { package: true, pendingPackage: true },
    })
    return toCompanyPackageInfo(cleared)
  }

  const company = await getCompanyById(cp.companyId)
  const providerName = company ? detectActiveProvider(company) : null

  if (providerName === "paypal" && company?.paypalSubscriptionId) {
    const { paymentDevMode } = await getPaymentSettings()
    try {
      const planRef = await ensureProviderPlanRef(cp.pendingPackage, "paypal", paymentDevMode)
      const result = await (await getProvider("paypal")).reviseSubscription(
        { subscriptionId: company.paypalSubscriptionId, newPlanRef: planRef, isUpgrade: false },
        paymentDevMode,
      )
      if (result.status !== "applied") {
        logger.error("PayPal downgrade revise required re-approval at apply time — no user present to redirect.", {
          context: "packages.applyDuePendingDowngrade",
          companyId: cp.companyId,
          metadata: { pendingPackageId: cp.pendingPackageId },
        })
        return toCompanyPackageInfo(cp)
      }
    } catch (error) {
      logger.error("Failed to apply a due PayPal downgrade — will retry on next read.", {
        context: "packages.applyDuePendingDowngrade",
        companyId: cp.companyId,
        metadata: { pendingPackageId: cp.pendingPackageId, error: String(error) },
      })
      return toCompanyPackageInfo(cp)
    }
  }
  // Stripe: nothing to call here — the price swap already happened, inertly, at schedule time.

  const now = new Date()
  const [updated] = await prisma.$transaction([
    prisma.companyPackage.update({
      where: { companyId: cp.companyId },
      data: {
        packageId: cp.pendingPackage.id,
        status: "ACTIVE",
        pendingPackageId: null,
        pendingEffectiveAt: null,
        paidAt: now,
      },
      include: { package: true, pendingPackage: true },
    }),
    prisma.invoice.create({
      data: {
        companyId: cp.companyId,
        packageId: cp.pendingPackage.id,
        amount: cp.pendingPackage.price,
        status: "PAID",
        paidAt: now,
        periodStart: now,
        periodEnd: new Date(now.getTime() + 30 * 86400000),
      },
    }),
  ])

  return toCompanyPackageInfo(updated)
}

export async function getOrCreateCompanyPackage(
  companyId: string,
): Promise<CompanyPackageInfo> {
  const existing = await getCompanyPackage(companyId)
  if (existing) return existing

  return startTrial(companyId)
}

/**
 * Starts (or restarts) a company's trial: full feature access, no plan chosen
 * yet, for `PlatformSettings.trialDays` days.
 */
export async function startTrial(companyId: string): Promise<CompanyPackageInfo> {
  const { trialDays } = await getPlatformSettings()

  const now = new Date()
  const trialEnd = new Date(now.getTime() + trialDays * 86400000)

  const cp = await prisma.companyPackage.upsert({
    where: { companyId },
    update: {
      packageId: null,
      status: "TRIAL",
      trialStart: now,
      trialEnd,
      paidAt: null,
      pendingPackageId: null,
      pendingEffectiveAt: null,
    },
    create: {
      companyId,
      status: "TRIAL",
      trialStart: now,
      trialEnd,
    },
    include: { package: true, pendingPackage: true },
  })

  return toCompanyPackageInfo(cp)
}

export async function handlePaymentSuccess(
  companyId: string,
  packageSlug: string,
  provider: "stripe" | "paypal",
  providerSubscriptionId: string,
  providerCustomerId: string,
): Promise<CompanyPackageInfo> {
  const pkg = await prisma.package.findUnique({ where: { slug: packageSlug } })
  if (!pkg) throw new Error(`Package "${packageSlug}" not found.`)

  const { paymentDevMode } = await getPaymentSettings()
  const now = new Date()

  const updateData: Record<string, unknown> = {}
  if (provider === "stripe") {
    updateData.stripeSubscriptionId = providerSubscriptionId
    updateData.stripeCustomerId = providerCustomerId
    updateData.subscriptionStatus = "active"
  } else {
    updateData.paypalSubscriptionId = providerSubscriptionId
    updateData.paypalPlanId = await ensureProviderPlanRef(pkg, "paypal", paymentDevMode)
  }

  // If the company already has a live subscription on the OTHER provider
  // (switching payment methods), cancel it now so activating this one doesn't
  // leave both billing in parallel.
  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (company) {
    const otherProvider: "stripe" | "paypal" | null =
      provider === "stripe" && company.paypalSubscriptionId
        ? "paypal"
        : provider === "paypal" && company.stripeSubscriptionId
          ? "stripe"
          : null

    if (otherProvider) {
      const oldSubscriptionId =
        otherProvider === "stripe" ? company.stripeSubscriptionId! : company.paypalSubscriptionId!
      try {
        await (await getProvider(otherProvider)).cancelSubscription(oldSubscriptionId, paymentDevMode)
      } catch (error) {
        logger.error("Failed to cancel prior-provider subscription during a cross-provider switch.", {
          context: "packages.handlePaymentSuccess",
          companyId,
          metadata: { otherProvider, oldSubscriptionId, error: String(error) },
        })
      }
      updateData[otherProvider === "stripe" ? "stripeSubscriptionId" : "paypalSubscriptionId"] = null
      if (otherProvider === "stripe") updateData.stripeCustomerId = null
    }
  }

  const [cp] = await prisma.$transaction([
    prisma.companyPackage.upsert({
      where: { companyId },
      update: {
        packageId: pkg.id,
        status: "ACTIVE",
        trialStart: null,
        trialEnd: null,
        paidAt: now,
        pendingPackageId: null,
        pendingEffectiveAt: null,
      },
      create: {
        companyId,
        packageId: pkg.id,
        status: "ACTIVE",
        paidAt: now,
      },
      include: { package: true, pendingPackage: true },
    }),
    prisma.invoice.create({
      data: {
        companyId,
        packageId: pkg.id,
        amount: pkg.price,
        status: "PAID",
        paidAt: now,
        periodStart: now,
        periodEnd: new Date(now.getTime() + 30 * 86400000),
      },
    }),
    prisma.company.update({
      where: { id: companyId },
      data: updateData,
    }),
  ])

  return toCompanyPackageInfo(cp)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Moves a company's CompanyPackage row (and records an invoice) onto a plan
 * whose provider-side change is already confirmed. Shared by three callers —
 * an immediate upgrade, a return-page confirm after subscriber re-approval,
 * and the webhook that fires when that re-approval lands — so it's idempotent:
 * if the company is already on the target package (e.g. the return-page
 * confirm and the webhook both fired for the same change), it's a no-op
 * rather than a duplicate invoice.
 */
async function applyConfirmedUpgrade(
  companyId: string,
  targetPkg: Package,
): Promise<CompanyPackageInfo> {
  const existing = await prisma.companyPackage.findUnique({
    where: { companyId },
    include: { package: true, pendingPackage: true },
  })
  if (existing?.packageId === targetPkg.id) {
    return toCompanyPackageInfo(existing)
  }

  const now = new Date()
  const [cp] = await prisma.$transaction([
    prisma.companyPackage.update({
      where: { companyId },
      data: {
        packageId: targetPkg.id,
        status: "ACTIVE",
        pendingPackageId: null,
        pendingEffectiveAt: null,
        paidAt: now,
      },
      include: { package: true, pendingPackage: true },
    }),
    prisma.invoice.create({
      data: {
        companyId,
        packageId: targetPkg.id,
        amount: targetPkg.price,
        status: "PAID",
        paidAt: now,
        periodStart: now,
        periodEnd: new Date(now.getTime() + 30 * 86400000),
      },
    }),
  ])
  return toCompanyPackageInfo(cp)
}

export type UpgradeOutcome =
  | { status: "applied"; companyPackage: CompanyPackageInfo; prorationAmount?: number }
  /** PayPal decided this plan change needs the subscriber to re-approve — send them to `approvalUrl`. */
  | { status: "requires_approval"; approvalUrl: string }

/**
 * Upgrades a company already on an active paid plan to a more expensive one,
 * immediately, by revising its existing subscription in place (rather than
 * cancel+recreate). The provider computes and charges the prorated difference
 * itself — no proration math here.
 *
 * PayPal can refuse to apply a revise outright and instead demand fresh
 * subscriber consent — `returnUrls` (if given) is where PayPal sends them to
 * do that; the caller must complete the switch via `confirmPendingUpgrade`
 * once they're back, since nothing is written to the DB until then.
 */
export async function upgradeCompanyPackage(
  companyId: string,
  targetPackageSlug: string,
  returnUrls?: { successUrl: string; cancelUrl: string },
): Promise<UpgradeOutcome> {
  const company = await getCompanyById(companyId)
  if (!company) throw new Error(`Company "${companyId}" not found.`)

  const providerName = detectActiveProvider(company)
  const subscriptionId =
    providerName === "stripe"
      ? company.stripeSubscriptionId
      : providerName === "paypal"
        ? company.paypalSubscriptionId
        : null
  if (!providerName || !subscriptionId) {
    throw new Error("Company has no active subscription to upgrade.")
  }

  const targetPkg = await prisma.package.findUnique({ where: { slug: targetPackageSlug } })
  if (!targetPkg) throw new Error(`Package "${targetPackageSlug}" not found.`)

  const { paymentDevMode } = await getPaymentSettings()
  const planRef = await ensureProviderPlanRef(targetPkg, providerName, paymentDevMode)

  const result = await (await getProvider(providerName)).reviseSubscription(
    { subscriptionId, newPlanRef: planRef, isUpgrade: true, ...returnUrls },
    paymentDevMode,
  )

  if (result.status === "requires_approval") {
    if (!result.approvalUrl) {
      throw new Error("This upgrade requires re-approval from the subscriber, but no approval link was provided.")
    }
    return { status: "requires_approval", approvalUrl: result.approvalUrl }
  }

  const companyPackage = await applyConfirmedUpgrade(companyId, targetPkg)
  return { status: "applied", companyPackage, prorationAmount: result.prorationAmount }
}

/**
 * Completes an upgrade that PayPal sent the subscriber off to re-approve,
 * called from the account page once they're redirected back. Polls briefly
 * since PayPal can take a moment to reflect the approval on the subscription.
 */
const CONFIRM_UPGRADE_RETRY_ATTEMPTS = 5
const CONFIRM_UPGRADE_RETRY_DELAY_MS = 1000

export async function confirmPendingUpgrade(
  companyId: string,
  targetPackageSlug: string,
): Promise<CompanyPackageInfo> {
  const company = await getCompanyById(companyId)
  if (!company) throw new Error(`Company "${companyId}" not found.`)
  if (!company.paypalSubscriptionId) throw new Error("Company has no PayPal subscription to confirm.")

  const targetPkg = await prisma.package.findUnique({ where: { slug: targetPackageSlug } })
  if (!targetPkg) throw new Error(`Package "${targetPackageSlug}" not found.`)
  if (!targetPkg.paypalPlanId) throw new Error(`Package "${targetPackageSlug}" has no PayPal plan ref cached.`)

  const { paymentDevMode } = await getPaymentSettings()
  const provider = await getProvider("paypal")
  if (!provider.getSubscriptionStatus) throw new Error("PayPal subscription status check not supported.")

  let status = await provider.getSubscriptionStatus(company.paypalSubscriptionId, paymentDevMode)
  for (
    let attempt = 1;
    status.planId !== targetPkg.paypalPlanId && attempt < CONFIRM_UPGRADE_RETRY_ATTEMPTS;
    attempt++
  ) {
    await sleep(CONFIRM_UPGRADE_RETRY_DELAY_MS)
    status = await provider.getSubscriptionStatus(company.paypalSubscriptionId, paymentDevMode)
  }

  if (status.planId !== targetPkg.paypalPlanId) {
    throw new Error(
      "The plan change hasn't been approved yet. If you completed approval on PayPal, wait a moment and refresh.",
    )
  }

  return applyConfirmedUpgrade(companyId, targetPkg)
}

/**
 * Webhook counterpart to `confirmPendingUpgrade` — fires when PayPal notifies
 * us a revise was approved. custom_id on the subscription still reflects the
 * ORIGINAL signup package, so the Package is found by its cached plan ref
 * instead. `applyConfirmedUpgrade`'s idempotency guard covers the case where
 * the return-page confirm already applied this same change.
 */
export async function handlePlanRevisionConfirmed(
  companyId: string,
  providerPlanId: string,
): Promise<CompanyPackageInfo> {
  const targetPkg = await prisma.package.findFirst({ where: { paypalPlanId: providerPlanId } })
  if (!targetPkg) throw new Error(`No package found for PayPal plan "${providerPlanId}".`)
  return applyConfirmedUpgrade(companyId, targetPkg)
}

/**
 * Schedules a downgrade to take effect at the end of the current paid
 * period — the company keeps its current (higher) plan's features and isn't
 * charged again until then. Stripe's item is revised inertly right away
 * (no immediate billing impact); PayPal's revise has no clean "apply later"
 * primitive, so its provider call is deferred until the downgrade actually
 * comes due (see applyDuePendingDowngrade).
 */
export async function scheduleDowngrade(
  companyId: string,
  targetPackageSlug: string,
): Promise<{ companyPackage: CompanyPackageInfo; effectiveAt: Date }> {
  const company = await getCompanyById(companyId)
  if (!company) throw new Error(`Company "${companyId}" not found.`)

  const current = await getCompanyPackage(companyId)
  if (!current || current.status !== "ACTIVE" || !current.package) {
    throw new Error("Company has no active plan to downgrade from.")
  }

  const targetPkg = await prisma.package.findUnique({ where: { slug: targetPackageSlug } })
  if (!targetPkg) throw new Error(`Package "${targetPackageSlug}" not found.`)
  if (targetPkg.price >= current.package.price) {
    throw new Error("Use the upgrade path for this change.")
  }

  const providerName = detectActiveProvider(company)
  const subscriptionId =
    providerName === "stripe"
      ? company.stripeSubscriptionId
      : providerName === "paypal"
        ? company.paypalSubscriptionId
        : null
  if (!providerName || !subscriptionId) {
    throw new Error("Company has no active subscription to downgrade.")
  }

  const { paymentDevMode } = await getPaymentSettings()
  const effectiveAt = await (await getProvider(providerName)).getCurrentPeriodEnd(
    subscriptionId,
    paymentDevMode,
  )

  if (providerName === "stripe") {
    const planRef = await ensureProviderPlanRef(targetPkg, "stripe", paymentDevMode)
    await (await getProvider("stripe")).reviseSubscription(
      { subscriptionId, newPlanRef: planRef, isUpgrade: false },
      paymentDevMode,
    )
  }
  // PayPal: no provider call yet — deferred until the downgrade actually comes due.

  const cp = await prisma.companyPackage.update({
    where: { companyId },
    data: { pendingPackageId: targetPkg.id, pendingEffectiveAt: effectiveAt },
    include: { package: true, pendingPackage: true },
  })

  return { companyPackage: toCompanyPackageInfo(cp), effectiveAt }
}

/**
 * Cancels a downgrade that's scheduled but hasn't taken effect yet. Idempotent
 * no-op if nothing is pending.
 */
export async function cancelPendingDowngrade(companyId: string): Promise<CompanyPackageInfo> {
  const cp = await prisma.companyPackage.findUnique({
    where: { companyId },
    include: { package: true, pendingPackage: true },
  })
  if (!cp) throw new Error(`Company "${companyId}" has no package record.`)
  if (!cp.pendingPackageId || !cp.package) {
    return toCompanyPackageInfo(cp)
  }

  const company = await getCompanyById(companyId)
  const providerName = company ? detectActiveProvider(company) : null

  if (providerName === "stripe" && company?.stripeSubscriptionId) {
    const { paymentDevMode } = await getPaymentSettings()
    const planRef = await ensureProviderPlanRef(cp.package, "stripe", paymentDevMode)
    await (await getProvider("stripe")).reviseSubscription(
      { subscriptionId: company.stripeSubscriptionId, newPlanRef: planRef, isUpgrade: false },
      paymentDevMode,
    )
  }
  // PayPal: nothing to revert — no provider call was ever made for a merely-scheduled downgrade.

  const updated = await prisma.companyPackage.update({
    where: { companyId },
    data: { pendingPackageId: null, pendingEffectiveAt: null },
    include: { package: true, pendingPackage: true },
  })

  return toCompanyPackageInfo(updated)
}

/** Sets a company's subscription to CANCELLED — called from the webhook routes. */
export async function handleSubscriptionCancelled(companyId: string): Promise<CompanyPackageInfo> {
  const cp = await prisma.companyPackage.update({
    where: { companyId },
    data: { status: "CANCELLED" },
    include: { package: true, pendingPackage: true },
  })
  return toCompanyPackageInfo(cp)
}

/**
 * Dev/no-real-provider stand-in for switching plans, mirroring `simulatePayment`.
 * Upgrades behave identically to `simulatePayment`. Downgrades DO write real
 * `pendingPackageId`/`pendingEffectiveAt` so the lazy-apply path in
 * `getCompanyPackage` is exercised end-to-end in local dev without real
 * PayPal/Stripe credentials — that path is the actual bug being fixed here.
 */
export async function simulateSwitch(
  companyId: string,
  targetPackageSlug: string,
): Promise<{
  companyPackage: CompanyPackageInfo
  kind: "upgraded" | "downgrade_scheduled"
  effectiveAt?: Date
}> {
  const current = await getCompanyPackage(companyId)
  if (!current || current.status !== "ACTIVE" || !current.package) {
    throw new Error("Company has no active plan to switch from.")
  }

  const targetPkg = await prisma.package.findUnique({ where: { slug: targetPackageSlug } })
  if (!targetPkg) throw new Error(`Package "${targetPackageSlug}" not found.`)

  if (targetPkg.price > current.package.price) {
    const companyPackage = await simulatePayment(companyId, targetPackageSlug)
    return { companyPackage, kind: "upgraded" }
  }

  const effectiveAt = new Date(Date.now() + 30 * 86400000)
  const cp = await prisma.companyPackage.update({
    where: { companyId },
    data: { pendingPackageId: targetPkg.id, pendingEffectiveAt: effectiveAt },
    include: { package: true, pendingPackage: true },
  })

  return { companyPackage: toCompanyPackageInfo(cp), kind: "downgrade_scheduled", effectiveAt }
}

export async function simulatePayment(
  companyId: string,
  packageSlug: string,
): Promise<CompanyPackageInfo> {
  const pkg = await prisma.package.findUnique({ where: { slug: packageSlug } })
  if (!pkg) throw new Error(`Package "${packageSlug}" not found.`)

  const now = new Date()

  const [cp] = await prisma.$transaction([
    prisma.companyPackage.upsert({
      where: { companyId },
      update: {
        packageId: pkg.id,
        status: "ACTIVE",
        trialStart: null,
        trialEnd: null,
        paidAt: now,
        pendingPackageId: null,
        pendingEffectiveAt: null,
      },
      create: {
        companyId,
        packageId: pkg.id,
        status: "ACTIVE",
        paidAt: now,
      },
      include: { package: true, pendingPackage: true },
    }),
    prisma.invoice.create({
      data: {
        companyId,
        packageId: pkg.id,
        amount: pkg.price,
        status: "PAID",
        paidAt: now,
        periodStart: now,
        periodEnd: new Date(now.getTime() + 30 * 86400000),
      },
    }),
  ])

  return toCompanyPackageInfo(cp)
}

export async function expireTrial(companyId: string): Promise<CompanyPackageInfo> {
  const cp = await prisma.companyPackage.update({
    where: { companyId },
    data: { status: "EXPIRED" },
    include: { package: true, pendingPackage: true },
  })

  const company = await getCompanyById(companyId)
  if (company) {
    await notifyTrialExpired({ to: company.email, companyName: company.name })
  }

  return toCompanyPackageInfo(cp)
}

/** How many days before trial end a reminder email is sent. */
const TRIAL_REMINDER_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

/**
 * Expires overdue trials (returning how many) and sends expiring/expired
 * reminders. Intended to be run on a schedule; without a cron it also fires
 * on demand. Expiring-reminder dedup isn't tracked, so prefer running this
 * once daily.
 */
export async function checkAndExpireTrials(): Promise<number> {
  const now = new Date()

  const due = await prisma.companyPackage.findMany({
    where: { status: "TRIAL", trialEnd: { lte: now } },
    select: { companyId: true },
  })

  if (due.length > 0) {
    await prisma.companyPackage.updateMany({
      where: { status: "TRIAL", trialEnd: { lte: now } },
      data: { status: "EXPIRED" },
    })
    for (const cp of due) {
      const company = await getCompanyById(cp.companyId)
      if (company) {
        await notifyTrialExpired({ to: company.email, companyName: company.name })
      }
    }
  }

  const expiring = await prisma.companyPackage.findMany({
    where: {
      status: "TRIAL",
      trialEnd: { gte: now, lte: new Date(now.getTime() + TRIAL_REMINDER_WINDOW_MS) },
    },
    select: { companyId: true, trialEnd: true },
  })
  for (const cp of expiring) {
    const company = await getCompanyById(cp.companyId)
    if (company && cp.trialEnd) {
      await notifyTrialExpiring({
        to: company.email,
        companyName: company.name,
        trialEnd: cp.trialEnd,
      })
    }
  }

  return due.length
}

export async function getCompanyInvoices(companyId: string): Promise<Invoice[]> {
  return prisma.invoice.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  })
}

export async function createPackage(data: {
  slug: string
  name: string
  price: number
  features: string
  sortOrder?: number
}): Promise<Package> {
  return prisma.package.create({ data: { sortOrder: 0, ...data } })
}

export async function updatePackage(
  id: string,
  data: Partial<{
    name: string
    price: number
    features: string
    sortOrder: number
  }>,
): Promise<Package> {
  return prisma.package.update({ where: { id }, data })
}

export async function countCompaniesOnPackage(packageId: string): Promise<number> {
  return prisma.companyPackage.count({
    where: { OR: [{ packageId }, { pendingPackageId: packageId }] },
  })
}

export async function deletePackage(id: string): Promise<void> {
  await prisma.package.delete({ where: { id } })
}
