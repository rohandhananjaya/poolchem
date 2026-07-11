import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns a Supabase Auth **admin** client (service-role key), or `null` when
 * the service-role env vars aren't configured (e.g. local dev without a
 * Supabase project). Callers must handle the `null` case.
 *
 * The service-role key bypasses Row Level Security — only ever use this from
 * server-side code that has already re-checked auth.
 */
export function createAdminClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) return null;

  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Deletes the Supabase Auth user matching `email`, so the identity doesn't
 * outlive the Prisma `User` row (which would otherwise block re-registering
 * the same email with "already been registered").
 *
 * No-ops when the admin client isn't configured or no auth user matches.
 * Never throws — deletion of app data should not fail because the auth
 * identity was already gone.
 */
export async function deleteAuthUserByEmail(email: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const target = email.trim().toLowerCase();

  // auth-js has no lookup-by-email, so page through the user list.
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return;

    const users = data?.users ?? [];
    const match = users.find((u) => u.email?.toLowerCase() === target);
    if (match) {
      await admin.auth.admin.deleteUser(match.id);
      return;
    }

    if (users.length < perPage) return; // last page
  }
}
