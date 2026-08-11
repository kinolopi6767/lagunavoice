import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client (session auth).
 * Use in Server Components, Route Handlers, and Server Actions.
 * Never expose the service_role key here — this uses the anon key + cookies.
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
            const secure = process.env.NODE_ENV === "production";
            cookiesToSet.forEach(({ name, value }) =>
              cookieStore.set(name, value, {
                httpOnly: true,
                secure,
                sameSite: "lax",
              }),
            );
          } catch {
            // Called from a Server Component — safe to ignore when middleware refreshes sessions
          }
        },
      },
    },
  );
}
