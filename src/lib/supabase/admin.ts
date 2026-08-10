import { type Database } from "@/types/supabase";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * ADMIN client — full database access bypassing RLS.
 * SERVER-ONLY. NEVER import this into client components or route modules
 * that run in the browser. Guarded by an explicit runtime check.
 */
export async function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient must only be used on the server");
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // admin client does not write cookies
        },
      },
    },
  );
}
