import path from "node:path";
import type { NextConfig } from "next";

// Satış ekranı /satis altında yayınlanır (ters vekil: /satis → satis-web, /api/satis → satis-api).
// Geliştirmede /api/satis istekleri Next tarafından satış API'sine yönlendirilir: aynı köken, çerez ve CSRF kuralı üretimle aynı.
const SATIS_API_URL = process.env.SATIS_API_URL ?? "http://localhost:4100";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  // Satış ekranı arama motorlarında görünmez
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  basePath: "/satis",
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    return [{ source: "/api/satis/:path*", destination: `${SATIS_API_URL}/api/satis/:path*`, basePath: false }];
  },
};

export default nextConfig;
