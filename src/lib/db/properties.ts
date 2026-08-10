/**
 * Data access for {@link Property} records.
 *
 * A Property is a physical location (a customer's home/business) that can hold
 * one or more pools — the multi-body grouping primitive. Every read/write is
 * scoped to a tenant (`companyId`) like the rest of this layer.
 *
 * Read-by-id helpers return `null` when nothing matches (a normal outcome).
 * Writes that would touch a Property outside the given company throw, so a
 * caller never silently succeeds against the wrong tenant.
 *
 * {@link setPoolProperty} is the tenant-safe way to attach a Pool to a Property
 * (or detach it): it validates that the Property belongs to the SAME company as
 * the Pool before writing the FK.
 */
import "server-only";

import type { Pool, Property } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Fields accepted when creating a Property. */
export interface CreatePropertyData {
  name: string;
  address?: string | null;
  notes?: string | null;
}

/** Fields that may be changed on an existing Property. */
export type UpdatePropertyData = Partial<CreatePropertyData>;

/** A Property augmented with its attached pools. */
export type PropertyWithPools = Property & { pools: Pool[] };

/** Returns true for Prisma's "record not found" error (P2025). */
function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

/**
 * Returns all of a company's Properties, each with its attached pools (ordered
 * by name). Ordered by name.
 */
export async function getPropertiesByCompany(
  companyId: string,
): Promise<PropertyWithPools[]> {
  return prisma.property.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    include: { pools: { orderBy: { name: "asc" } } },
  });
}

/**
 * Returns a single Property, but only if it belongs to `companyId`. Returns
 * `null` when the Property does not exist or is owned by another company — the
 * relation safety check that keeps one tenant from reading another's data.
 */
export async function getPropertyById(
  propertyId: string,
  companyId: string,
): Promise<Property | null> {
  return prisma.property.findFirst({ where: { id: propertyId, companyId } });
}

/** Creates a new Property for `companyId`. */
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
 * Updates a Property, but only if it belongs to `companyId`.
 *
 * @throws {Error} If no Property with `propertyId` is owned by `companyId`.
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
 * Permanently deletes a Property. Attached pools are NOT deleted — their
 * `propertyId` is set to null (detach), so a property deletion never destroys
 * pools or their visit history.
 *
 * @throws {Error} If no Property with `propertyId` is owned by `companyId`.
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
 * Attaches a Pool to a Property, or detaches it (pass `null`), but only when
 * both records belong to `companyId`. This is the tenant-FK guard: a pool can
 * never be linked to another company's Property.
 *
 * @throws {Error} If the Property or the Pool isn't owned by `companyId`.
 */
export async function setPoolProperty(
  poolId: string,
  propertyId: string | null,
  companyId: string,
): Promise<Pool> {
  if (propertyId !== null) {
    const property = await getPropertyById(propertyId, companyId);
    if (!property) {
      throw new Error(
        `Property "${propertyId}" not found for company "${companyId}" (or not owned by it).`,
      );
    }
  }

  const { count } = await prisma.pool.updateMany({
    where: { id: poolId, companyId },
    data: { propertyId },
  });

  if (count === 0) {
    throw new Error(
      `Pool "${poolId}" not found for company "${companyId}" (or not owned by it).`,
    );
  }

  // count > 0 guarantees the row exists.
  return prisma.pool.findUniqueOrThrow({ where: { id: poolId } });
}
