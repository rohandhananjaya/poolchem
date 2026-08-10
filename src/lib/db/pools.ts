/**
 * Data access for {@link Pool} records.
 *
 * Every read/write is scoped to a tenant (`companyId`) except {@link getPoolByQR}
 * and {@link generateQRCode}, which are keyed off a pool's globally-unique QR
 * value (a tech scans a code before we know which company it belongs to — the
 * caller is responsible for checking the returned pool against the tech's
 * company).
 *
 * Read-by-id helpers return `null` when nothing matches (a normal outcome).
 * Writes that would touch a pool outside the given company throw, so a caller
 * never silently succeeds against the wrong tenant.
 */
import "server-only";

import { randomUUID } from "node:crypto";

import { PAGE_SIZE } from "@/lib/config";
import type { Pool } from "@/generated/prisma/client";
import { Prisma, ServiceVisitStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getPropertyById } from "@/lib/db/properties";

/** Filters for the paginated pools list. */
export interface PoolsFilters {
  /** Free-text search against name and address. */
  search?: string;
  /** Defaults to `"active"` when omitted. */
  status?: "active" | "inactive" | "all";
}

/** How many pools to show per page. */
export const POOLS_PAGE_SIZE = PAGE_SIZE;

/** Total number of pools for a company, regardless of active/inactive status. */
export async function getPoolCount(companyId: string): Promise<number> {
  return prisma.pool.count({ where: { companyId } });
}

/**
 * Returns a paginated, filterable list of pools for `companyId`, each annotated
 * with the date of its most recent service visit.
 */
export async function getPoolsPaginated(
  companyId: string,
  page: number = 1,
  filters?: PoolsFilters,
): Promise<{ pools: PoolWithLastVisit[]; total: number }> {
  const limit = POOLS_PAGE_SIZE;
  const skip = (page - 1) * limit;

  const where: Prisma.PoolWhereInput = { companyId };

  if (filters?.status === "active" || !filters?.status) {
    where.isActive = true;
  } else if (filters?.status === "inactive") {
    where.isActive = false;
  }
  // "all" — no isActive filter

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { address: { contains: filters.search } },
    ];
  }

  const [pools, total] = await Promise.all([
    prisma.pool.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: limit,
      include: {
        serviceVisits: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
    prisma.pool.count({ where }),
  ]);

  return {
    pools: pools.map(({ serviceVisits, ...pool }) => ({
      ...pool,
      lastVisitAt: serviceVisits[0]?.createdAt ?? null,
    })),
    total,
  };
}

/**
 * Permanently deletes a pool and all its cascaded records (service visits,
 * water readings, chemical logs).
 *
 * @throws {Error} If no pool with `poolId` is owned by `companyId`.
 */
export async function deletePool(
  poolId: string,
  companyId: string,
): Promise<void> {
  try {
    await prisma.pool.delete({ where: { id: poolId, companyId } });
  } catch (error) {
    if (isRecordNotFound(error)) {
      throw new Error(
        `Pool "${poolId}" not found for company "${companyId}" (or not owned by it).`,
      );
    }
    throw error;
  }
}

/** Fields accepted when creating a pool. `qrCode` is generated for you. */
export interface CreatePoolData {
  name: string;
  /** Capacity in US gallons. */
  volume: number;
  address?: string | null;
  image?: string | null;
  notes?: string | null;
  homeownerEmail?: string | null;
  homeownerPhone?: string | null;
  /** Optional multi-body grouping. Must belong to the same company, else throws. */
  propertyId?: string | null;
}

/** Fields that may be changed on an existing pool. */
export type UpdatePoolData = Partial<CreatePoolData> & { isActive?: boolean };

/** A pool augmented with the timestamp of its most recent service visit. */
export type PoolWithLastVisit = Pool & { lastVisitAt: Date | null };

/** Returns true for Prisma's "record not found" error (P2025). */
function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

/** Returns true for Prisma's "foreign key constraint" error (P2003). */
function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  );
}

/** Mints a new globally-unique QR identifier for a pool. */
function newQRCode(): string {
  return `POOL-${randomUUID()}`;
}

/**
 * Tenant-FK guard for pool writes that reference a property: throws unless the
 * property resolves to the same `companyId` the pool belongs to. A leaky FK
 * here would let one tenant group a pool under another tenant's property.
 */
async function assertSameCompanyProperty(
  propertyId: string,
  companyId: string,
): Promise<void> {
  const property = await getPropertyById(propertyId, companyId);
  if (!property) {
    throw new Error(
      `Property "${propertyId}" not found for company "${companyId}" (or not owned by it).`,
    );
  }
}

/**
 * Returns all active pools for a company, each annotated with the date of its
 * most recent service visit (`null` if never visited). Ordered by name.
 */
export async function getPoolsByCompany(
  companyId: string,
): Promise<PoolWithLastVisit[]> {
  const pools = await prisma.pool.findMany({
    where: { companyId, isActive: true },
    orderBy: { name: "asc" },
    include: {
      serviceVisits: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  return pools.map(({ serviceVisits, ...pool }) => ({
    ...pool,
    lastVisitAt: serviceVisits[0]?.createdAt ?? null,
  }));
}

/**
 * Returns a single pool, but only if it belongs to `companyId`. Returns `null`
 * when the pool does not exist or is owned by another company — the relation
 * safety check that keeps one tenant from reading another's data.
 */
export async function getPoolById(
  poolId: string,
  companyId: string,
): Promise<Pool | null> {
  return prisma.pool.findFirst({ where: { id: poolId, companyId } });
}

/** Creates a new pool for `companyId`, generating a unique QR code. */
export async function createPool(
  data: CreatePoolData,
  companyId: string,
): Promise<Pool> {
  if (data.propertyId != null) {
    await assertSameCompanyProperty(data.propertyId, companyId);
  }

  try {
    return await prisma.pool.create({
      data: {
        name: data.name,
        volume: data.volume,
        address: data.address ?? null,
        image: data.image ?? null,
        notes: data.notes ?? null,
        homeownerEmail: data.homeownerEmail ?? null,
        homeownerPhone: data.homeownerPhone ?? null,
        ...(data.propertyId != null
          ? { property: { connect: { id: data.propertyId } } }
          : {}),
        qrCode: newQRCode(),
        company: { connect: { id: companyId } },
      },
    });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      // Property was deleted between the guard above and this write.
      throw new Error(
        `Property "${data.propertyId}" not found for company "${companyId}" (or not owned by it).`,
      );
    }
    throw error;
  }
}

/**
 * Creates each pool in `rows`, in order, isolating any per-row failure
 * instead of aborting the whole batch — used by CSV import, where partial
 * success (skip the bad rows, keep the good ones) is the desired behavior.
 */
export async function createPoolsBulk(
  rows: CreatePoolData[],
  companyId: string,
): Promise<{ created: Pool[]; failed: { index: number; error: string }[] }> {
  const created: Pool[] = [];
  const failed: { index: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    try {
      created.push(await createPool(rows[i], companyId));
    } catch {
      failed.push({ index: i, error: "Could not create this pool." });
    }
  }

  return { created, failed };
}

/**
 * All of a company's pools, active and inactive, ordered by name — for a
 * full CSV export (unlike {@link getPoolsByCompany}, which is active-only).
 */
export async function getAllPoolsForExport(companyId: string): Promise<Pool[]> {
  return prisma.pool.findMany({ where: { companyId }, orderBy: { name: "asc" } });
}

/**
 * Updates a pool, but only if it belongs to `companyId`.
 *
 * @throws {Error} If no pool with `poolId` is owned by `companyId`.
 */
export async function updatePool(
  poolId: string,
  data: UpdatePoolData,
  companyId: string,
): Promise<Pool> {
  if (data.propertyId != null) {
    await assertSameCompanyProperty(data.propertyId, companyId);
  }

  let count: number;
  try {
    ({ count } = await prisma.pool.updateMany({
      where: { id: poolId, companyId },
      data,
    }));
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      // Property was deleted between the guard above and this write.
      throw new Error(
        `Property "${data.propertyId}" not found for company "${companyId}" (or not owned by it).`,
      );
    }
    throw error;
  }

  if (count === 0) {
    throw new Error(
      `Pool "${poolId}" not found for company "${companyId}" (or not owned by it).`,
    );
  }

  // count > 0 guarantees the row exists.
  return prisma.pool.findUniqueOrThrow({ where: { id: poolId } });
}

/**
 * Looks up a pool by its QR code — the entry point for a tech scanning a pool
 * in the field. Not company-scoped; callers must verify the returned pool's
 * `companyId` against the acting user. Returns `null` for an unknown code.
 */
export async function getPoolByQR(qrCode: string): Promise<Pool | null> {
  return prisma.pool.findUnique({ where: { qrCode } });
}

/**
 * Looks up a pool by its public dashboard token, eager-loading the owning
 * company and the pool's most recent completed visits (newest first) with their
 * readings and servicing tech — everything the public homeowner dashboard needs
 * in one query.
 *
 * NOT company-scoped: the unguessable `publicToken` *is* the access grant, so
 * this powers the no-login `/pool/[publicToken]` page. Returns `null` for an
 * unknown token (→ 404).
 *
 * @param publicToken - The pool's public token.
 * @param visitLimit - How many recent completed visits to include.
 */
export async function getPoolByPublicToken(
  publicToken: string,
  visitLimit: number,
) {
  return prisma.pool.findUnique({
    where: { publicToken },
    include: {
      company: true,
      serviceVisits: {
        where: { status: ServiceVisitStatus.COMPLETED },
        orderBy: { createdAt: "desc" },
        take: visitLimit,
        include: { waterReadings: true, tech: true },
      },
    },
  });
}

/**
 * Assigns a fresh, unique QR identifier to a pool and returns it. Use to
 * (re)issue a printable code for a pool.
 *
 * @throws {Error} If no pool with `poolId` exists.
 */
export async function generateQRCode(poolId: string): Promise<string> {
  const qrCode = newQRCode();
  try {
    await prisma.pool.update({ where: { id: poolId }, data: { qrCode } });
  } catch (error) {
    if (isRecordNotFound(error)) {
      throw new Error(`Cannot generate QR code: pool "${poolId}" not found.`);
    }
    throw error;
  }
  return qrCode;
}
