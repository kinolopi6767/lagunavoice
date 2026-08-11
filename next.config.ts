import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    // ffmpeg-static resolves its binary via __dirname — must NOT be bundled
    // (Turbopack rewrites __dirname to the bundle root and the binary 404s).
    "ffmpeg-static",
  ],
  headers: async () => [
    {
      // Security headers on every response (API + pages).
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        {
          key: "Content-Security-Policy",
          // frame-ancestors 'self' blocks clickjacking of the admin/billing
          // panels. 'unsafe-inline' scripts are required by Next's bootstrap
          // runtime and the inline dark-mode init script in layout.tsx.
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "media-src 'self' blob:",
            "font-src 'self' data:",
            "connect-src 'self' https://api.lugunavoice.com https://*.supabase.co",
            "frame-ancestors 'self'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join("; "),
        },
      ],
    },
  ],
};

export default nextConfig;