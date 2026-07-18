import "server-only"

import type { Package, CompanyPackage, Invoice } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
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
    trialDays: pkg.trialDays,
    sortOrder: pkg.sortOrder,
  }
}

export function toCompanyPackageInfo(
  cp: CompanyPackage & { package: Package },
): CompanyPackageInfo {
  return {
    package: toPackageInfo(cp.package),
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
  packageSlug = "starter",
): Promise<CompanyPackageInfo> {
  const existing = await getCompanyPackage(companyId)
  if (existing) return existing

  const pkg = await prisma.package.findUnique({ where: { slug: packageSlug } })
  if (!pkg) {
    const fallback = await prisma.package.findFirst({ orderBy: { sortOrder: "asc" } })
    if (!fallback) throw new Error("No packages exist in the database.")
    const cp = await prisma.companyPackage.create({
      data: { companyId, packageId: fallback.id },
      include: { package: true },
    })
    return toCompanyPackageInfo(cp)
  }

  const cp = await prisma.companyPackage.create({
    data: { companyId, packageId: pkg.id },
    include: { package: true },
  })
  return toCompanyPackageInfo(cp)
}

export async function startTrial(
  companyId: string,
  packageSlug: string,
): Promise<CompanyPackageInfo> {
  const pkg = await prisma.package.findUnique({ where: { slug: packageSlug } })
  if (!pkg) throw new Error(`Package "${packageSlug}" not found.`)

  const now = new Date()
  const trialEnd = new Date(now.getTime() + pkg.trialDays * 86400000)

  const cp = await prisma.companyPackage.upsert({
    where: { companyId },
    update: {
      packageId: pkg.id,
      status: "TRIAL",
      trialStart: now,
      trialEnd,
      paidAt: null,
    },
    create: {
      companyId,
      packageId: pkg.id,
      status: "TRIAL",
      trialStart: now,
      trialEnd,
    },
    include: { package: true },
  })

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

export async function adminSetPackage(
  companyId: string,
  packageId: string,
  status: "TRIAL" | "ACTIVE" | "EXPIRED" | "CANCELLED",
  trialDays?: number,
): Promise<CompanyPackageInfo> {
  const pkg = await prisma.package.findUnique({ where: { id: packageId } })
  if (!pkg) throw new Error(`Package "${packageId}" not found.`)

  const now = new Date()
  const isTrial = status === "TRIAL"
  const trialEnd = isTrial && trialDays
    ? new Date(now.getTime() + trialDays * 86400000)
    : null

  const cp = await prisma.companyPackage.upsert({
    where: { companyId },
    update: {
      packageId,
      status,
      trialStart: isTrial ? now : null,
      trialEnd,
      paidAt: status === "ACTIVE" ? now : null,
    },
    create: {
      companyId,
      packageId,
      status,
      trialStart: isTrial ? now : null,
      trialEnd,
      paidAt: status === "ACTIVE" ? now : null,
    },
    include: { package: true },
  })

  return toCompanyPackageInfo(cp)
}

export async function getCompanyInvoices(companyId: string): Promise<Invoice[]> {
  return prisma.invoice.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  })
}

export async function getAllCompaniesWithPackages() {
  return prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      companyPackage: { include: { package: true } },
      _count: { select: { users: true, pools: true } },
    },
  })
}

export async function createPackage(data: {
  slug: string
  name: string
  price: number
  features: string
  trialDays: number
  sortOrder: number
}): Promise<Package> {
  return prisma.package.create({ data })
}

export async function updatePackage(
  id: string,
  data: Partial<{
    name: string
    price: number
    features: string
    trialDays: number
    sortOrder: number
  }>,
): Promise<Package> {
  return prisma.package.update({ where: { id }, data })
}

export async function deletePackage(id: string): Promise<void> {
  await prisma.package.delete({ where: { id } })
}
