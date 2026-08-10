"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client (anon key, safe for client bundles).
 * Used by login/signup forms and any client-side session reads.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
