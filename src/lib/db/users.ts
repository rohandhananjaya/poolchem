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
}

/** Fields required to create a new user (SUPER_ADMIN only). */
export interface CreateUserData {
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
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
 * Creates a new user belonging to a company (SUPER_ADMIN only).
 */
export async function createUser(
  data: CreateUserData,
): Promise<User> {
  return prisma.user.create({ data });
}

/**
 * Deletes a user scoped to a company.
 *
 * @throws {Error} If no user with `userId` is found in the given company.
 */
export async function deleteUser(
  userId: string,
  companyId: string,
): Promise<void> {
  const { count } = await prisma.user.deleteMany({
    where: { id: userId, companyId },
  });

  if (count === 0) {
    throw new Error(
      `User "${userId}" not found for the given scope.`,
    );
  }
}
