import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    // ffmpeg-static resolves its binary via __dirname — must NOT be bundled
    // (Turbopack rewrites __dirname to the bundle root and the binary 404s).
    "ffmpeg-static",
  ],
};

export default nextConfig;
