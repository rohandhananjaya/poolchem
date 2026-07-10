import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for use in Server Components, Route Handlers and Server
 * Actions.
 *
 * `cookies()` is async in this version of Next.js, so this factory is async too
 * — always `await createClient()`. Uses the `getAll`/`setAll` cookie interface
 * required by `@supabase/ssr` (the older get/set/remove API is deprecated).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` was called from a Server Component, where writing cookies
            // is not allowed. This can be ignored as long as `proxy.ts`
            // refreshes the session on every request.
          }
        },
      },
    },
  );
}
