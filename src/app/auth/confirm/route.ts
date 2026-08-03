import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

// Landing page for our own token_hash-based links (signup confirmation, and any
// future OTP-type link) built by admin.generateLink() — see requestPasswordResetAction
// for why we build our own URL instead of using Supabase's action_link. Mirrors
// auth/callback/route.ts's code-exchange flow, but verifies a token_hash instead
// of exchanging a code.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/onboarding";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirm_failed`);
}
