/**
 * Data access for {@link ServiceVisitPool} — the join rows linking a
 * ServiceVisit to each Pool (body of water) it serves.
 *
 * Join-row creation happens in the createVisit rework (`src/lib/db/visits.ts`),
 * which calls `assertPoolsBelongToCompany` before writing. `companyId` is
 * stored directly on the join so tenancy filters stay indexed; the invariant
 * that a join row's `companyId` MUST equal its pool's `companyId` is enforced
 * at write time by `assertPoolsBelongToCompany`.
 */
import "server-only";

import type { Pool, ServiceVisit, ServiceVisitPool } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** A join row eager-loaded with the pool it references. */
export type ServiceVisitPoolWithPool = ServiceVisitPool & { pool: Pool };

/**
 * Returns the join rows for a visit, each with its pool attached. Only rows
 * belonging to `companyId` are returned — a cross-tenant visit id yields `[]`.
 */
export async function getServiceVisitPoolsByVisit(
  visitId: string,
  companyId: string,
): Promise<ServiceVisitPoolWithPool[]> {
  return prisma.serviceVisitPool.findMany({
    where: { serviceVisitId: visitId, companyId },
    include: { pool: true },
  });
}

/**
 * Returns the pools (bodies of water) served by a visit — a convenience
 * wrapper over {@link getServiceVisitPoolsByVisit}. Empty for a cross-tenant
 * visit id.
 */
export async function getPoolsByVisit(
  visitId: string,
  companyId: string,
): Promise<Pool[]> {
  const rows = await getServiceVisitPoolsByVisit(visitId, companyId);
  return rows.map((row) => row.pool);
}

/**
 * Returns the visits that served a given pool, scoped to `companyId` via the
 * join rows, and body-scoped on the returned readings/chemicals: a multi-pool
 * visit contributes only THIS pool's readings/chemicals to its history row.
 * Newest first.
 *
 * @param limit - Maximum number of visits to return; all when omitted.
 */
export async function getVisitsByPool(
  poolId: string,
  companyId: string,
  limit?: number,
): Promise<ServiceVisit[]> {
  return prisma.serviceVisit.findMany({
    where: { serviceVisitPools: { some: { poolId, companyId } } },
    orderBy: { createdAt: "desc" },
    ...(limit !== undefined ? { take: limit } : {}),
    include: {
      waterReadings: { where: { serviceVisitPool: { poolId } } },
      chemicalsAdded: { where: { serviceVisitPool: { poolId } } },
      tech: true,
    },
  });
}

/**
 * Tenant-FK guard: throws unless EVERY given pool resolves to `companyId`.
 * Also throws on an empty `poolIds` array (a visit must serve at least one
 * pool). This is the invariant join-row writes (the createVisit rework card)
 * must call before creating rows.
 *
 * @throws {Error} When `poolIds` is empty or any pool is missing / owned by
 * another company.
 */
export async function assertPoolsBelongToCompany(
  poolIds: string[],
  companyId: string,
): Promise<void> {
  if (poolIds.length === 0) {
    throw new Error("At least one pool is required.");
  }

  const pools = await prisma.pool.findMany({
    where: { id: { in: poolIds }, companyId },
    select: { id: true },
  });

  const owned = new Set(pools.map((pool) => pool.id));
  const foreign = poolIds.filter((poolId) => !owned.has(poolId));
  if (foreign.length > 0) {
    throw new Error(
      `Pool(s) ${foreign.join(", ")} not found for company "${companyId}" (or not owned by it).`,
    );
  }
}
