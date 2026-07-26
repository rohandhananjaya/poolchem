import "server-only"

import type { Package, CompanyPackage, Invoice } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { getPlatformSettings } from "@/lib/db/platform-settings"
import {
  parseFeatures,
  type PackageInfo,
  type CompanyPackageInfo,
} from "@/lib/package-features"

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

export function toCompanyPackageInfo(
  cp: CompanyPackage & { package: Package | null },
): CompanyPackageInfo {
  return {
    package: cp.package ? toPackageInfo(cp.package) : null,
    status: cp.status,
    trialStart: cp.trialStart,
    trialEnd: cp.trialEnd,
    paidAt: cp.paidAt,
  }
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
    include: { package: true },
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
      include: { package: true },
    })
    return toCompanyPackageInfo(updated)
  }

  return toCompanyPackageInfo(cp)
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
    },
    create: {
      companyId,
      status: "TRIAL",
      trialStart: now,
      trialEnd,
    },
    include: { package: true },
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

  const now = new Date()

  const updateData: Record<string, unknown> = {}
  if (provider === "stripe") {
    updateData.stripeSubscriptionId = providerSubscriptionId
    updateData.stripeCustomerId = providerCustomerId
    updateData.subscriptionStatus = "active"
  } else {
    updateData.paypalSubscriptionId = providerSubscriptionId
    updateData.paypalPlanId = pkg.id
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
      },
      create: {
        companyId,
        packageId: pkg.id,
        status: "ACTIVE",
        paidAt: now,
      },
      include: { package: true },
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
      },
      create: {
        companyId,
        packageId: pkg.id,
        status: "ACTIVE",
        paidAt: now,
      },
      include: { package: true },
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
    include: { package: true },
  })
  return toCompanyPackageInfo(cp)
}

export async function checkAndExpireTrials(): Promise<number> {
  const now = new Date()
  const result = await prisma.companyPackage.updateMany({
    where: {
      status: "TRIAL",
      trialEnd: { lte: now },
    },
    data: { status: "EXPIRED" },
  })
  return result.count
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
  return prisma.companyPackage.count({ where: { packageId } })
}

export async function deletePackage(id: string): Promise<void> {
  await prisma.package.delete({ where: { id } })
}
