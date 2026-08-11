import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/callback — OAuth + email verification code exchange
 * (required by the @supabase/ssr PKCE flow).
 * Safe when Supabase is not configured: redirects with a friendly hint
 * instead of crashing.
 */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/studio";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    } catch {
      return NextResponse.redirect(`${origin}/login?error=auth_not_configured`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}