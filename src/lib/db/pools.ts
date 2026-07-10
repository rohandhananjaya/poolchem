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

import type { Pool } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Fields accepted when creating a pool. `qrCode` is generated for you. */
export interface CreatePoolData {
  name: string;
  /** Capacity in US gallons. */
  volume: number;
  address?: string | null;
  image?: string | null;
  notes?: string | null;
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

/** Mints a new globally-unique QR identifier for a pool. */
function newQRCode(): string {
  return `POOL-${randomUUID()}`;
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
  return prisma.pool.create({
    data: {
      name: data.name,
      volume: data.volume,
      address: data.address ?? null,
      image: data.image ?? null,
      notes: data.notes ?? null,
      qrCode: newQRCode(),
      company: { connect: { id: companyId } },
    },
  });
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
  const { count } = await prisma.pool.updateMany({
    where: { id: poolId, companyId },
    data,
  });

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
        where: { status: "COMPLETED" },
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
