import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../../platform/database/prisma.service.js';

export const TOKEN_PREFIX = 'mt_';
// gib:import → GİB sayfasından beyanname ve tebligat aktarma. declarations:import eski anahtarlar için kabul edilir.
export const SCOPES = ['gib:import', 'declarations:import'] as const;
export type Scope = (typeof SCOPES)[number];

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
/** Eklenti anahtarı ömrü: süresi dolan anahtar çalışmaz, kullanıcı yenisini üretir. */
const ttlMs = () => Number(process.env.API_TOKEN_TTL_DAYS ?? 90) * 86_400_000;

@Injectable()
export class ApiTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** Yeni anahtar üretir. Düz metin anahtar sadece burada döner, bir daha elde edilemez. */
  async create(tenantId: string, userId: string, name: string, scopes: Scope[]) {
    const token = TOKEN_PREFIX + randomBytes(32).toString('base64url');
    const row = await this.prisma.apiToken.create({
      data: { tenantId, userId, name, scopes, tokenHash: hash(token), prefix: token.slice(0, 8), expiresAt: new Date(Date.now() + ttlMs()) },
      select: { id: true, name: true, prefix: true, scopes: true, createdAt: true, expiresAt: true },
    });
    return { ...row, token };
  }

  list(tenantId: string) {
    return this.prisma.apiToken.findMany({
      where: { tenantId, revokedAt: null },
      select: { id: true, name: true, prefix: true, scopes: true, lastUsedAt: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(tenantId: string, id: string) {
    const { count } = await this.prisma.apiToken.updateMany({
      where: { id, tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!count) throw new NotFoundException('Anahtar bulunamadı');
  }

  /** Anahtar geçerli ve istenen yetkiye sahipse sahibini döner. */
  async verify(token: string, scopes: Scope[]) {
    const row = await this.prisma.apiToken.findUnique({ where: { tokenHash: hash(token) } });
    if (!row || row.revokedAt || !scopes.some((s) => row.scopes.includes(s))) return null;
    if (row.expiresAt && row.expiresAt < new Date()) return null;
    // Anahtarın sahibi devre dışı bırakıldıysa anahtar da çalışmaz
    const owner = await this.prisma.user.findUnique({
      where: { id: row.userId },
      select: { isActive: true, totpEnabledAt: true, tenant: { select: { require2fa: true } } },
    });
    if (!owner?.isActive) return null;
    // Büroda 2FA zorunluysa, 2FA kurmamış kullanıcının eklenti anahtarı da çalışmaz
    if (owner.tenant.require2fa && !owner.totpEnabledAt) return null;
    await this.prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
    return { tenantId: row.tenantId, userId: row.userId, tokenId: row.id };
  }
}
