import { NextResponse, type NextRequest } from 'next/server';

// Nonce'lu CSP (01 §4; satış portalı da portal ile aynı politika): her istekte yeni nonce; Next.js kendi betiklerine uygular. Tarayıcı yalnız aynı kökene bağlanır.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const gelistirme = process.env.NODE_ENV === 'development';
  // SSH tüneliyle http://localhost üzerinden açılan üretim satış portalında https'e yükseltme kaynakları kırar
  const yerel = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(request.headers.get('host') ?? '');
  const https = process.env.COOKIE_SECURE !== 'false' && !yerel;
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${gelistirme ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
  const istek = new Headers(request.headers);
  istek.set('x-nonce', nonce);
  istek.set('Content-Security-Policy', csp);
  const yanit = NextResponse.next({ request: { headers: istek } });
  yanit.headers.set('Content-Security-Policy', csp);
  return yanit;
}

export const config = {
  matcher: [{ source: '/((?!api|_next/static|_next/image|favicon.ico).*)', missing: [{ type: 'header', key: 'next-router-prefetch' }] }],
};
