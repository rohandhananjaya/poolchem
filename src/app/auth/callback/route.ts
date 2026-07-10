import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Supabase redirects here after OAuth (e.g. Google) and other flows that return
// a `code`. We exchange it for a session (which writes the auth cookies via the
// server client) and then send the user on to their destination.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Where to send the user after a successful sign-in.
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No code, or the exchange failed — back to login with an error flag.
  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
