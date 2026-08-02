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
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value),
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

  // Protect /dashboard/*, /admin/* and /scan — send unauthenticated users to
  // /login. Query params (e.g. ?code= from a scanned QR deep link) are carried
  // over so the login flow can route straight back into the visit.
  if (
    !user &&
    (pathname.startsWith("/dashboard") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/scan"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return copyCookies(response, NextResponse.redirect(url));
  }

  // Keep authenticated users away from /login and /signup.
  if (user && (pathname === "/login" || pathname === "/signup")) {
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
  // Run on everything except static assets, image files, and /api/* — API
  // routes authenticate via their own bearer-token check (see
  // src/lib/api-keys/auth.ts), not a Supabase cookie session, so running the
  // session-refresh logic against them is both pointless and unnecessary
  // latency. Auth proxies should otherwise run broadly so sessions refresh on
  // every navigation.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
