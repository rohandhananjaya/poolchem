import "server-only";

import { cache } from "react";

import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

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
    throw new Error("Unauthorized: no authenticated user");
  }
  return user;
}

/**
 * Returns the `companyId` for the current session — the tenant every record is
 * scoped to. Throws if not authenticated.
 */
export async function getCompanyId(): Promise<string> {
  const user = await requireAuth();
  return user.companyId;
}
