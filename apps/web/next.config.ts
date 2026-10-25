import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Güvenlik başlıkları (01 §4): CSP proxy.ts'te nonce'lu kurulur; burada nonce gerektirmeyenler.
const config: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: kok,
  turbopack: { root: kok },
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  transpilePackages: ['@eworks/feature-registry', '@eworks/identity-access', '@eworks/kernel', '@eworks/platform'],
  serverExternalPackages: ['pg', 'ioredis'],
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
