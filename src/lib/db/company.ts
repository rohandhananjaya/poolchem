/**
 * Data access for {@link Company} records — the tenant every other record is
 * scoped to — plus aggregate stats for a company dashboard.
 */
import "server-only";

import type { Company } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { PAGE_SIZE } from "@/lib/config";
import { getWaterHealthScore } from "@/lib/pool-chemistry";
import { prisma } from "@/lib/prisma";

/** Fields that may be changed on a company's profile. */
export interface UpdateCompanyData {
  name?: string;
  logo?: string | null;
  email?: string;
  phone?: string | null;
  address?: string | null;
  active?: boolean;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string | null;
  fromEmail?: string | null;
}

/** Fields required to create a new company. */
export interface CreateCompanyData {
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  fromEmail?: string | null;
}

/** Headline metrics for a company dashboard. */
export interface CompanyStats {
  /** Number of active pools. */
  totalPools: number;
  /** Visits created since the start of the current calendar month. */
  visitsThisMonth: number;
  /**
   * Mean water-health score (0–100) across recent readings, or `null` when the
   * company has no readings yet.
   */
  averageWaterHealth: number | null;
}

/** How many recent readings feed the average-water-health metric. */
const HEALTH_SAMPLE_SIZE = 200;

/** Returns true for Prisma's "record not found" error (P2025). */
function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

/** Local start-of-month timestamp. */
function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Returns a company by id, or `null` if it does not exist. */
export async function getCompanyById(
  companyId: string,
): Promise<Company | null> {
  return prisma.company.findUnique({ where: { id: companyId } });
}

/**
 * Finds the company whose currently-recorded subscription id matches, for a
 * given provider. Returns `null` if no company currently has this id active —
 * e.g. it was already superseded by a plan switch before an async cancellation
 * webhook for the old id arrives, which is a benign, ignorable miss.
 */
export async function getCompanyBySubscriptionId(
  provider: "stripe" | "paypal",
  subscriptionId: string,
): Promise<Company | null> {
  return prisma.company.findFirst({
    where:
      provider === "stripe"
        ? { stripeSubscriptionId: subscriptionId }
        : { paypalSubscriptionId: subscriptionId },
  });
}

/**
 * Updates a company's profile.
 *
 * @throws {Error} If no company with `companyId` exists.
 */
export async function updateCompany(
  companyId: string,
  data: UpdateCompanyData,
): Promise<Company> {
  try {
    return await prisma.company.update({ where: { id: companyId }, data });
  } catch (error) {
    if (isRecordNotFound(error)) {
      throw new Error(`Company "${companyId}" not found.`);
    }
    throw error;
  }
}

/**
 * Creates a new company.
 */
export async function createCompany(
  data: CreateCompanyData,
): Promise<Company> {
  return prisma.company.create({ data });
}

/**
 * Deletes a company and all its cascaded records (users, pools, visits, etc.).
 *
 * @throws {Error} If no company with `companyId` exists.
 */
export async function deleteCompany(companyId: string): Promise<void> {
  try {
    await prisma.company.delete({ where: { id: companyId } });
  } catch (error) {
    if (isRecordNotFound(error)) {
      throw new Error(`Company "${companyId}" not found.`);
    }
    throw error;
  }
}

/**
 * Computes dashboard stats for a company: active pool count, visits so far this
 * month, and the mean water-health score across its most recent readings.
 */
export async function getCompanyStats(
  companyId: string,
): Promise<CompanyStats> {
  const monthStart = startOfMonth();

  const [totalPools, visitsThisMonth, readings] = await Promise.all([
    prisma.pool.count({ where: { companyId, isActive: true } }),
    prisma.serviceVisit.count({
      where: { pool: { companyId }, createdAt: { gte: monthStart } },
    }),
    prisma.waterReading.findMany({
      where: { visit: { pool: { companyId } } },
      orderBy: { createdAt: "desc" },
      take: HEALTH_SAMPLE_SIZE,
      select: {
        ph: true,
        freeChlorine: true,
        totalAlkalinity: true,
        calciumHardness: true,
        cyanuricAcid: true,
        temperature: true,
      },
    }),
  ]);

  const averageWaterHealth =
    readings.length === 0
      ? null
      : Math.round(
          readings.reduce(
            (sum, reading) => sum + getWaterHealthScore(reading).score,
            0,
          ) / readings.length,
        );

  return { totalPools, visitsThisMonth, averageWaterHealth };
}

/** How many companies to show per page in the admin list. */
export const COMPANIES_PAGE_SIZE = PAGE_SIZE;

/** A company row with its user and pool counts. */
type CompanyWithCounts = Prisma.CompanyGetPayload<{
  include: { _count: { select: { users: true; pools: true } } }
}>

/**
 * Returns a paginated list of all companies (super-admin view), each annotated
 * with its user and pool counts. Ordered most-recent-first.
 */
export async function getCompaniesPaginated(
  page: number = 1,
): Promise<{ companies: CompanyWithCounts[]; total: number }> {
  const limit = COMPANIES_PAGE_SIZE;
  const skip = (page - 1) * limit;

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        _count: { select: { users: true, pools: true } },
      },
    }),
    prisma.company.count(),
  ]);

  return { companies, total };
}

/**
 * Returns the effective "from" email address for a company's transactional
 * emails. Prefers the company-level `fromEmail` when set; falls back to the
 * app-level `EMAIL_FROM` env var; finally returns a sensible default.
 */
export function getCompanyFromEmail(company: {
  fromEmail: string | null;
}): string {
  if (company.fromEmail) return company.fromEmail;
  return process.env.EMAIL_FROM ?? "noreply@poolbench.app";
}
