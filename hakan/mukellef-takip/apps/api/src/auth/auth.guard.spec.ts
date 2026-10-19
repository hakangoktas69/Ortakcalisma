import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../prisma.service.js';
import { verifySession } from './auth.guard.js';

const payload = { sub: 'u1', tenantId: 't1', role: 'STAFF' as const, sv: 3 };

function fakes(user: Partial<{ mustChangePassword: boolean; totpEnabledAt: Date | null; require2fa: boolean; sessionVersion: number }>) {
  const jwt = { verifyAsync: async () => payload } as unknown as JwtService;
  const prisma = {
    user: {
      findUnique: async () => ({
        isActive: true,
        sessionVersion: user.sessionVersion ?? 3,
        mustChangePassword: user.mustChangePassword ?? false,
        role: 'STAFF',
        tenantId: 't1',
        totpEnabledAt: user.totpEnabledAt ?? null,
        tenant: { require2fa: user.require2fa ?? false },
      }),
    },
  } as unknown as PrismaService;
  return [jwt, prisma] as const;
}

async function codeOf(p: Promise<unknown>) {
  try {
    await p;
    return 'OK';
  } catch (e) {
    if (e instanceof ForbiddenException) return (e.getResponse() as { code: string }).code;
    if (e instanceof UnauthorizedException) return 'UNAUTHORIZED';
    throw e;
  }
}

describe('verifySession: 2FA zorunluluğu', () => {
  it('zorunlu ve kurulmamışsa sadece me, şifre ve 2FA kurulum uçlarına izin verir', async () => {
    const [jwt, prisma] = fakes({ require2fa: true });
    expect(await codeOf(verifySession(jwt, prisma, 't', '/api/companies'))).toBe('TWO_FACTOR_REQUIRED');
    expect(await codeOf(verifySession(jwt, prisma, 't', '/api/inbox?x=1'))).toBe('TWO_FACTOR_REQUIRED');
    expect(await codeOf(verifySession(jwt, prisma, 't', '/api/auth/2fa/disable'))).toBe('TWO_FACTOR_REQUIRED');
    for (const ok of ['/api/auth/me', '/api/auth/password', '/api/auth/2fa/setup', '/api/auth/2fa/enable']) {
      expect(await codeOf(verifySession(jwt, prisma, 't', ok))).toBe('OK');
    }
  });

  it('kullanıcı 2FA kurduysa ya da zorunluluk kapalıysa engel yok', async () => {
    expect(await codeOf(verifySession(...fakes({ require2fa: true, totpEnabledAt: new Date() }), 't', '/api/companies'))).toBe('OK');
    expect(await codeOf(verifySession(...fakes({ require2fa: false }), 't', '/api/companies'))).toBe('OK');
  });

  it('şifre değiştirme zorunluluğu önce gelir', async () => {
    const [jwt, prisma] = fakes({ require2fa: true, mustChangePassword: true });
    expect(await codeOf(verifySession(jwt, prisma, 't', '/api/companies'))).toBe('PASSWORD_CHANGE_REQUIRED');
    expect(await codeOf(verifySession(jwt, prisma, 't', '/api/auth/2fa/setup'))).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('oturum sürümü eskiyse oturum geçersiz', async () => {
    expect(await codeOf(verifySession(...fakes({ sessionVersion: 4 }), 't', '/api/companies'))).toBe('UNAUTHORIZED');
  });
});
