import "server-only";

import { cache } from "react";

import type { User, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { AuthError, UnauthorizedError } from "@/lib/errors";

/**
 * Returns the currently signed-in user from **our** `User` table (which carries
 * `companyId` and app-specific fields), not just the Supabase auth record.
 *
 * The link between Supabase auth and our table is the email address (unique on
 * `User`). Returns `null` if there's no session or no matching User row.
 *
 * Wrapped in React `cache` so multiple calls within a single request/render
 * only hit Supabase + the DB once.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  return prisma.user.findUnique({ where: { email: user.email } });
});

/**
 * Returns the current user, or throws if not authenticated. Use in Server
 * Actions, Route Handlers and data-access code that requires a signed-in user.
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError();
  }
  return user;
}

/**
 * Returns the current user only if they hold one of the allowed roles.
 *
 * @throws {UnauthorizedError} If not authenticated or not in the allowed roles.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<User> {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role as UserRole)) {
    throw new UnauthorizedError(
      `This action requires one of these roles: ${allowedRoles.join(", ")}.`,
    );
  }
  return user;
}

/**
 * Requires the current user to be an OWNER or SUPER_ADMIN.
 *
 * @throws {UnauthorizedError} If not authenticated or not an owner-level user.
 */
export async function requireOwner(): Promise<User> {
  return requireRole(["OWNER", "SUPER_ADMIN"]);
}

/**
 * Requires the current user to be a TECH, OWNER, or SUPER_ADMIN (any
 * authenticated internal user).
 *
 * @throws {UnauthorizedError} If not authenticated.
 */
export async function requireTech(): Promise<User> {
  return requireRole(["TECH", "OWNER", "SUPER_ADMIN"]);
}

/**
 * Requires the current user to be a SUPER_ADMIN (platform owner).
 *
 * @throws {UnauthorizedError} If not authenticated or not a SUPER_ADMIN.
 */
export async function requireSuperAdmin(): Promise<User> {
  return requireRole(["SUPER_ADMIN"]);
}

/**
 * Verifies the current user belongs to the given company, or is a SUPER_ADMIN
 * who may access any company.
 *
 * @throws {UnauthorizedError} If the user doesn't belong to the company.
 */
export async function requireCompanyAccess(
  companyId: string,
): Promise<User> {
  const user = await requireAuth();
  const role = user.role as UserRole;

  if (role === "SUPER_ADMIN") {
    return user;
  }

  if (user.companyId !== companyId) {
    throw new UnauthorizedError("You don't have access to this company.");
  }

  return user;
}

/**
 * Returns the `companyId` for the current session — the tenant every record is
 * scoped to. Returns `null` for SUPER_ADMIN (platform owner with no company).
 *
 * @throws {AuthError} If not authenticated.
 */
export async function getCompanyId(): Promise<string | null> {
  const user = await requireAuth();
  return user.companyId;
}

/**
 * Validates a pool's public token for homeowner access. Returns the pool and
 * its owning company, or `null` if the token is invalid.
 */
export async function validatePoolToken(token: string) {
  return prisma.pool.findUnique({
    where: { publicToken: token },
    include: { company: true },
  });
}
