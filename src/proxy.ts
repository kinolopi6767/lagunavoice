import { updateSession } from "@/lib/supabase/session";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 proxy (formerly middleware) — runs before every matching request.
 * Refreshes Supabase auth sessions and protects authenticated routes.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except: API routes, static files, images, fonts, icons,
     * favicon and audio assets.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|wav|woff2?)$).*)",
  ],
};
