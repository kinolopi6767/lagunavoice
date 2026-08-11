/**
 * Best-effort client IP for rate limits and abuse flags.
 *
 * Trust order:
 *  1. `x-real-ip` — set by nginx/Cloudflare AFTER stripping untrusted XFF.
 *  2. Last hop of `x-forwarded-for` — a reverse proxy appends the client to
 *     the end, so the last entry is the closest to the connection.
 *  3. `cf-connecting-ip` — Cloudflare direct.
 *
 * Using the FIRST XFF hop would let a client fully forge its IP, so we never
 * trust it. Local dev (no proxy) falls back to "unknown" — per-IP caps then
 * collapse to a single bucket, which is the safe behavior for testing.
 */
export function clientIp(request: Request): string {
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

  return request.headers.get("cf-connecting-ip") ?? "unknown";
}
