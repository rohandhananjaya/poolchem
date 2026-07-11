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

/** Fields required to create a new user. */
export interface CreateUserData {
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
  phone?: string | null;
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
