import { jwtVerify, SignJWT } from 'jose';
import type { AuthProvider, Tokens, VerifiedUser } from '../application/ports.ts';

// GoTrue (Supabase Auth) adaptörü. Yönetim çağrıları (kullanıcı açma) kısa ömürlü service_role JWT'siyle yapılır;
// bu JWT yalnız sunucuda üretilir, hiçbir yere yazılmaz. Hata gövdeleri kullanıcıya iletilmez.

type TokenResponse = { access_token: string; refresh_token: string; expires_in: number };

export class GoTrueAuthProvider implements AuthProvider {
  private readonly url: string;
  private readonly key: Uint8Array;
  private readonly now: () => number;

  constructor(url: string, jwtSecret: string, now: () => number = Date.now) {
    this.url = url.replace(/\/+$/, '');
    this.key = new TextEncoder().encode(jwtSecret);
    this.now = now;
  }

  private tokens(r: TokenResponse): Tokens {
    return { accessToken: r.access_token, refreshToken: r.refresh_token, expiresAt: this.now() + r.expires_in * 1000 };
  }

  private async post(path: string, body: unknown, bearer?: string) {
    return fetch(`${this.url}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  }

  async signIn(email: string, password: string): Promise<Tokens | null> {
    const r = await this.post('/token?grant_type=password', { email, password });
    if (r.status === 400 || r.status === 401 || r.status === 422) return null;
    if (!r.ok) throw new Error(`Kimlik servisi yanıt vermedi (${r.status})`);
    return this.tokens((await r.json()) as TokenResponse);
  }

  async refresh(refreshToken: string): Promise<Tokens | null> {
    const r = await this.post('/token?grant_type=refresh_token', { refresh_token: refreshToken });
    if (!r.ok) return null;
    return this.tokens((await r.json()) as TokenResponse);
  }

  async verify(accessToken: string): Promise<VerifiedUser | null> {
    try {
      const { payload } = await jwtVerify(accessToken, this.key, { algorithms: ['HS256'], audience: 'authenticated' });
      if (typeof payload.sub !== 'string' || payload['role'] !== 'authenticated') return null;
      return { id: payload.sub, email: typeof payload['email'] === 'string' ? payload['email'] : '' };
    } catch {
      return null;
    }
  }

  private serviceToken() {
    return new SignJWT({ role: 'service_role' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('2m').sign(this.key);
  }

  async createUser(email: string, password: string, name: string): Promise<{ id: string } | 'exists'> {
    const r = await this.post('/admin/users', { email, password, email_confirm: true, user_metadata: { name } }, await this.serviceToken());
    if (r.status === 422) return 'exists';
    if (!r.ok) throw new Error(`Kullanıcı açılamadı (${r.status})`);
    return { id: ((await r.json()) as { id: string }).id };
  }
}
