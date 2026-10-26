import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Satış portalı (ayrı imaj, ayrı port). Güvenlik başlıkları portal ile aynı: CSP proxy.ts'te nonce'lu, burada nonce gerektirmeyenler.
const config: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: kok,
  turbopack: { root: kok },
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  transpilePackages: ['@eworks/identity-access', '@eworks/kernel', '@eworks/platform', '@eworks/sales'],
  serverExternalPackages: ['pg', 'ioredis', 'qrcode'],
  // AGENTS.md tek kaynaktan üretilir (tools/ajan/senkron.mjs); `next dev` yazmasın
  agentRules: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

export default config;
