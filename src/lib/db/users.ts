/**
 * Data access for {@link User} records — the people who belong to a tenant.
 *
 * Writes are scoped to the acting company so a user can never edit a row that
 * belongs to another tenant. Editing a user's `email` is deliberately
 * unsupported here: `email` is the link between our Prisma `User` and Supabase
 * Auth.
 */
import "server-only";

import type { User, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Fields a user may change on their own profile. */
export interface UpdateUserData {
  name?: string;
}

/** Fields an owner or admin may change on another user. */
export interface UpdateUserAdminData {
  name?: string;
  role?: UserRole;
  phone?: string | null;
}

/** Fields required to create a new user. `companyId` is `null` for a SUPER_ADMIN, who has no tenant. */
export interface CreateUserData {
  name: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  phone?: string | null;
  /** The Supabase Auth user id, when a Supabase account was created for this user. */
  supabaseId?: string | null;
}

/**
 * Returns all users belonging to a company, ordered by creation date.
 */
export async function getUsersByCompany(
  companyId: string,
): Promise<User[]> {
  return prisma.user.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Returns only TECH-role users for a company, ordered by name — used when an
 * owner picks which tech to assign a visit to.
 */
export async function getCompanyTechs(
  companyId: string,
): Promise<Pick<User, "id" | "name" | "email">[]> {
  return prisma.user.findMany({
    where: { companyId, role: "TECH" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}

/** Counts TECH-role users for a company — used to enforce a plan's `max_techs`. */
export async function getCompanyTechCount(companyId: string): Promise<number> {
  return prisma.user.count({ where: { companyId, role: "TECH" } });
}

/**
 * Updates a user's profile. When `companyId` is provided, the update is scoped
 * to that tenant. When `null` (SUPER_ADMIN), any user can be updated by id.
 *
 * @throws {Error} If no user with `userId` is found for the given scope.
 */
export async function updateUser(
  userId: string,
  companyId: string | null,
  data: UpdateUserData,
) {
  const where =
    companyId === null
      ? { id: userId }
      : { id: userId, companyId };

  const { count } = await prisma.user.updateMany({ where, data });

  if (count === 0) {
    throw new Error(
      `User "${userId}" not found for the given scope.`,
    );
  }

  return prisma.user.findUniqueOrThrow({ where: { id: userId } });
}

/**
 * Updates a user's role. Only the specified scoping company (or SUPER_ADMIN
 * context) may perform this.
 *
 * @throws {Error} If no user with `userId` is found in `companyId`.
 */
export async function updateUserRole(
  userId: string,
  companyId: string | null,
  role: UserRole,
) {
  const where =
    companyId === null
      ? { id: userId }
      : { id: userId, companyId };

  const { count } = await prisma.user.updateMany({ where, data: { role } });

  if (count === 0) {
    throw new Error(
      `User "${userId}" not found for the given scope.`,
    );
  }

  return prisma.user.findUniqueOrThrow({ where: { id: userId } });
}

/**
 * All data belonging to a user, structured for GDPR right to data portability
 * (Art. 20). Returns the user's profile, company info, pools, and full visit
 * history with readings and chemicals.
 */
export interface UserExportData {
  exportedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    role: string;
    createdAt: string;
  };
  company: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    address: string | null;
    createdAt: string;
  } | null;
  pools: Array<{
    id: string;
    name: string;
    address: string | null;
    volume: number;
    createdAt: string;
    visits: Array<{
      id: string;
      status: string;
      notes: string | null;
      createdAt: string;
      reading: {
        ph: number;
        freeChlorine: number;
        totalAlkalinity: number;
        calciumHardness: number;
        cyanuricAcid: number;
        temperature: number;
      } | null;
      chemicals: Array<{
        name: string;
        amount: number;
        unit: string;
      }>;
    }>;
  }>;
}

/**
 * Gathers all user data for GDPR right to data portability (Art. 20).
 * Scoped to the user's company for multi-tenant safety.
 */
export async function getUserExportData(
  userId: string,
  companyId: string | null,
): Promise<UserExportData> {
  const user = await prisma.user.findUniqueOrThrow({
    where: companyId === null
      ? { id: userId }
      : { id: userId, companyId },
  });

  const company = companyId
    ? await prisma.company.findUnique({ where: { id: companyId } })
    : null;

  const pools = companyId
    ? await prisma.pool.findMany({
        where: { companyId, isActive: true },
        include: {
          serviceVisits: {
            orderBy: { createdAt: "desc" },
            include: {
              waterReadings: true,
              chemicalsAdded: true,
            },
          },
        },
        orderBy: { name: "asc" },
      })
    : [];

  const latestReading = (visits: typeof pools[number]["serviceVisits"]) => {
    const completed = visits.find((v) => v.status === "COMPLETED");
    if (!completed || completed.waterReadings.length === 0) return null;
    const r = completed.waterReadings[0];
    return {
      ph: r.ph,
      freeChlorine: r.freeChlorine,
      totalAlkalinity: r.totalAlkalinity,
      calciumHardness: r.calciumHardness,
      cyanuricAcid: r.cyanuricAcid,
      temperature: r.temperature,
    };
  };

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
    company: company
      ? {
          id: company.id,
          name: company.name,
          email: company.email,
          phone: company.phone,
          address: company.address,
          createdAt: company.createdAt.toISOString(),
        }
      : null,
    pools: pools.map((pool) => ({
      id: pool.id,
      name: pool.name,
      address: pool.address,
      volume: pool.volume,
      createdAt: pool.createdAt.toISOString(),
      visits: pool.serviceVisits.map((visit) => ({
        id: visit.id,
        status: visit.status,
        notes: visit.notes,
        createdAt: visit.createdAt.toISOString(),
        reading: latestReading([visit]),
        chemicals: visit.chemicalsAdded.map((c) => ({
          name: c.name,
          amount: c.amount,
          unit: c.unit,
        })),
      })),
    })),
  };
}

/**
 * Returns all users across all companies (SUPER_ADMIN only).
 */
export async function getAllUsers(): Promise<User[]> {
  return prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { company: true },
  });
}

/**
 * Updates a user's name, role, and/or phone (admin-level). Scoped to the
 * given company. Pass `companyId: null` for SUPER_ADMIN (unscoped).
 */
export async function updateUserAdmin(
  userId: string,
  companyId: string | null,
  data: UpdateUserAdminData,
) {
  const where =
    companyId === null
      ? { id: userId }
      : { id: userId, companyId };

  const { count } = await prisma.user.updateMany({ where, data });

  if (count === 0) {
    throw new Error(
      `User "${userId}" not found for the given scope.`,
    );
  }

  return prisma.user.findUniqueOrThrow({ where: { id: userId } });
}

/**
 * Creates a new user belonging to a company.
 */
export async function createUser(
  data: CreateUserData,
): Promise<User> {
  return prisma.user.create({ data });
}

/**
 * Whether a SUPER_ADMIN exists yet — the platform-owner setup wizard uses this
 * to decide whether it still needs to run.
 */
export async function hasSuperAdmin(): Promise<boolean> {
  const count = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
  return count > 0;
}

/**
 * Deletes a user scoped to a company. When `companyId` is `null` (SUPER_ADMIN
 * context), deletes by id without company scoping.
 *
 * @throws {Error} If no user with `userId` is found for the given scope.
 */
export async function deleteUser(
  userId: string,
  companyId: string | null,
): Promise<void> {
  const where =
    companyId === null
      ? { id: userId }
      : { id: userId, companyId };

  const { count } = await prisma.user.deleteMany({ where });

  if (count === 0) {
    throw new Error(
      `User "${userId}" not found for the given scope.`,
    );
  }
}
