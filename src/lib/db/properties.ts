/**
 * Data access for {@link Property} records — the optional multi-body grouping
 * of one or more pools at a physical location.
 *
 * Every read/write is scoped to a tenant (`companyId`), matching the invariant
 * in every other `db/` module: read-by-id helpers return `null` on a
 * cross-tenant miss, and writes that would touch a property outside the given
 * company throw.
 *
 * A pool's `propertyId` is optional (single-pool customers have none) and
 * detaches on property delete (`SetNull` — never cascades into pools).
 */
import "server-only";

import type { Pool, Property } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Fields accepted when creating a property. */
export interface CreatePropertyData {
  name: string;
  address?: string | null;
  notes?: string | null;
}

/** Fields that may be changed on an existing property. */
export type UpdatePropertyData = Partial<CreatePropertyData>;

/** A property eager-loaded with the pools attached to it. */
export type PropertyWithPools = Property & { pools: Pool[] };

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

/**
 * Returns all of a company's properties, each eager-loaded with its active
 * pools (inactive pools excluded, matching {@link getPoolsByCompany}).
 * Ordered by name.
 */
export async function getPropertiesByCompany(
  companyId: string,
): Promise<PropertyWithPools[]> {
  return prisma.property.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    include: { pools: { where: { isActive: true } } },
  });
}

/**
 * Returns a single property, but only if it belongs to `companyId`. Returns
 * `null` when the property does not exist or is owned by another company.
 */
export async function getPropertyById(
  propertyId: string,
  companyId: string,
): Promise<Property | null> {
  return prisma.property.findFirst({ where: { id: propertyId, companyId } });
}

/** Creates a new property for `companyId`. */
export async function createProperty(
  data: CreatePropertyData,
  companyId: string,
): Promise<Property> {
  return prisma.property.create({
    data: {
      name: data.name,
      address: data.address ?? null,
      notes: data.notes ?? null,
      company: { connect: { id: companyId } },
    },
  });
}

/**
 * Updates a property, but only if it belongs to `companyId`.
 *
 * @throws {Error} If no property with `propertyId` is owned by `companyId`.
 */
export async function updateProperty(
  propertyId: string,
  data: UpdatePropertyData,
  companyId: string,
): Promise<Property> {
  const { count } = await prisma.property.updateMany({
    where: { id: propertyId, companyId },
    data,
  });

  if (count === 0) {
    throw new Error(
      `Property "${propertyId}" not found for company "${companyId}" (or not owned by it).`,
    );
  }

  // count > 0 guarantees the row exists.
  return prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
}

/**
 * Permanently deletes a property. Any pools attached to it are detached
 * (`SetNull`), never deleted.
 *
 * @throws {Error} If no property with `propertyId` is owned by `companyId`.
 */
export async function deleteProperty(
  propertyId: string,
  companyId: string,
): Promise<void> {
  try {
    await prisma.property.delete({ where: { id: propertyId, companyId } });
  } catch (error) {
    if (isRecordNotFound(error)) {
      throw new Error(
        `Property "${propertyId}" not found for company "${companyId}" (or not owned by it).`,
      );
    }
    throw error;
  }
}

/**
 * Attaches (or detaches, when `propertyId` is `null`) a pool to a property.
 *
 * This is the tenant-FK guard: the property must resolve to the SAME company as
 * the pool, otherwise it throws — a pool can never be grouped under another
 * tenant's property.
 *
 * @throws {Error} If the pool is not owned by `companyId`, or the property does
 * not exist for `companyId`.
 */
export async function setPoolProperty(
  poolId: string,
  propertyId: string | null,
  companyId: string,
): Promise<Pool> {
  const pool = await prisma.pool.findFirst({
    where: { id: poolId, companyId },
  });
  if (!pool) {
    throw new Error(
      `Pool "${poolId}" not found for company "${companyId}" (or not owned by it).`,
    );
  }

  if (propertyId !== null) {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, companyId },
    });
    if (!property) {
      throw new Error(
        `Property "${propertyId}" not found for company "${companyId}" (or not owned by it).`,
      );
    }
  }

  let count: number;
  try {
    ({ count } = await prisma.pool.updateMany({
      where: { id: poolId, companyId },
      data: { propertyId },
    }));
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      // Property was deleted between the guard above and this write.
      throw new Error(
        `Property "${propertyId}" not found for company "${companyId}" (or not owned by it).`,
      );
    }
    throw error;
  }

  if (count === 0) {
    throw new Error(
      `Pool "${poolId}" not found for company "${companyId}" (or not owned by it).`,
    );
  }

  try {
    return await prisma.pool.findUniqueOrThrow({ where: { id: poolId } });
  } catch (error) {
    if (isRecordNotFound(error)) {
      throw new Error(
        `Pool "${poolId}" not found for company "${companyId}" (or not owned by it).`,
      );
    }
    throw error;
  }
}
