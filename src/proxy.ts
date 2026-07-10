import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// NOTE: In Next.js 16, Middleware was renamed to **Proxy**. This file replaces
// the `middleware.ts` you'd write in older Next.js — the functionality is the
// same (it runs before requests are completed). It lives in `src/` so it sits
// next to `app/`, and the entry function is exported as `proxy`.
//
// This proxy does two jobs:
//   1. Refreshes the Supabase auth session on every request (writing rotated
//      tokens back to the response cookies), which is required by @supabase/ssr.
//   2. Guards routes: /dashboard/* requires a session; a logged-in user hitting
//      /login is sent to /dashboard.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() must be called to trigger the token refresh. Do not run
  // other logic between creating the client and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protect /dashboard/* — send unauthenticated users to /login.
  if (!user && pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return copyCookies(response, NextResponse.redirect(url));
  }

  // Keep authenticated users away from /login.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return copyCookies(response, NextResponse.redirect(url));
  }

  // Return the (possibly cookie-updated) response so refreshed tokens persist.
  return response;
}

// Carry any refreshed session cookies from the working response onto a redirect
// so the rotated tokens aren't dropped.
function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

export const config = {
  // Run on everything except static assets and image files. Auth proxies should
  // run broadly so sessions refresh on every navigation.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
