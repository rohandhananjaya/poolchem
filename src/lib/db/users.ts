/**
 * Data access for {@link User} records — the people who belong to a tenant.
 *
 * Writes are scoped to the acting company so a user can never edit a row that
 * belongs to another tenant. Editing a user's `email` or `role` is deliberately
 * unsupported here: `email` is the link between our Prisma `User` and Supabase
 * Auth, and `role` is a privilege boundary — both need dedicated flows.
 */
import "server-only";

import { prisma } from "@/lib/prisma";

/** Fields a user may change on their own profile. */
export interface UpdateUserData {
  name?: string;
}

/**
 * Updates a user's profile, but only if the user belongs to `companyId`.
 *
 * @throws {Error} If no user with `userId` is owned by `companyId`.
 */
export async function updateUser(
  userId: string,
  companyId: string,
  data: UpdateUserData,
) {
  const { count } = await prisma.user.updateMany({
    where: { id: userId, companyId },
    data,
  });

  if (count === 0) {
    throw new Error(
      `User "${userId}" not found for company "${companyId}" (or not owned by it).`,
    );
  }

  // count > 0 guarantees the row exists.
  return prisma.user.findUniqueOrThrow({ where: { id: userId } });
}
