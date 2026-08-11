/**
 * Client IP for rate limits and abuse flags.
 *
 * DEPLOYMENT REQUIREMENT: the app MUST sit behind a trusted proxy that
 * overwrites these headers (Vercel/Cloudflare/nginx). The header is only as
 * trustworthy as that proxy — an attacker who can reach the origin directly
 * can spoof it. Never expose the origin port publicly.
 *
 * Trust order:
 *  1. `cf-connecting-ip` — Cloudflare direct (set by CF, cannot be client-set).
 *  2. `x-real-ip` — set by nginx/CF AFTER stripping untrusted XFF.
 *  3. Last hop of `x-forwarded-for` — a reverse proxy appends the client to
 *     the end, so the last entry is the closest to the connection.
 *
 * Using the FIRST XFF hop would let a client fully forge its IP, so we never
 * trust it. Local dev (no proxy) falls back to "unknown" — per-IP caps then
 * collapse to a single bucket, which is the safe behavior for testing.
 */
export function clientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;

  const real = request.headers.get("x-real-ip");
  if (real) return real;

  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const last = hops[hops.length - 1];
    if (last) return last;
  }

  return "unknown";
}
