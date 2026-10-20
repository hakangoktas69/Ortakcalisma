import path from "node:path";
import type { NextConfig } from "next";

// Temel güvenlik başlıkları. Nonce'lu sıkı CSP, BFF oturumuyla birlikte gelecek (docs/adr/0006).
// HSTS ters vekilde (Caddy) verilir.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://*.iyzipay.com; object-src 'none'" },
];

const nextConfig: NextConfig = {
  /* config options here */
  // Docker imajı için: .next/standalone yalnız gereken dosyaları içerir
  output: "standalone",
  // npm workspaces: bağımlılıklar kök node_modules'ta; izleme monorepo kökünden yapılır
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
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
};

export default nextConfig;
