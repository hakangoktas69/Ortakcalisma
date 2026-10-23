import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { AuditService } from '../../../platform/audit/audit.service.js';
import { runAsSystem } from '../../../platform/database/tenant-context.js';

export const REFRESH_PREFIX = 'rt_';
const hash = (t: string) => createHash('sha256').update(t).digest('hex');
const refreshTtlMs = () => Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7) * 86_400_000;

export interface SessionUser {
  id: string;
  tenantId: string;
  sessionVersion: number;
}

/**
 * Cihaz oturumları ve dönen yenileme anahtarları (docs/adr/0006).
 * - Yenileme anahtarı tek kullanımlıktır; her yenilemede aynı ailede yenisi üretilir.
 * - Kullanılmış bir anahtar tekrar gelirse (çalınma belirtisi) bütün aile iptal edilir.
 * - Anahtarın kendisi saklanmaz, SHA-256 özeti tutulur.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async start(u: SessionUser, meta: { userAgent?: string }) {
    return this.issue(u, randomUUID(), meta.userAgent);
  }

  private async issue(u: SessionUser, familyId: string, userAgent?: string) {
    const refreshToken = REFRESH_PREFIX + randomBytes(32).toString('base64url');
    const s = await this.prisma.session.create({
      data: {
        tenantId: u.tenantId,
        userId: u.id,
        familyId,
        tokenHash: hash(refreshToken),
        sessionVersion: u.sessionVersion,
        userAgent: userAgent?.slice(0, 200) ?? null,
        expiresAt: new Date(Date.now() + refreshTtlMs()),
      },
      select: { id: true },
    });
    return { sessionId: s.id, familyId, refreshToken };
  }

  /** Yenileme anahtarını döndürür. Geçersizse 401; yeniden kullanım tespitinde aile iptal edilir. */
  rotate(refreshToken: string, userAgent?: string) {
    return runAsSystem(async () => {
      const s = await this.prisma.session.findUnique({
        where: { tokenHash: hash(refreshToken) },
        include: { user: { select: { id: true, tenantId: true, sessionVersion: true, isActive: true } } },
      });
      if (!s) throw new UnauthorizedException('Oturum sona erdi, tekrar giriş yapın');
      if (s.replacedAt) {
        await this.revokeFamily(s.familyId, 'reuse');
        await this.audit.log({ tenantId: s.tenantId, userId: s.userId, action: 'auth.session.reuse-detected', detail: { familyId: s.familyId } });
        throw new UnauthorizedException('Oturum güvenlik nedeniyle sonlandırıldı, tekrar giriş yapın');
      }
      if (s.revokedAt || s.expiresAt < new Date() || !s.user.isActive || s.user.sessionVersion !== s.sessionVersion) {
        throw new UnauthorizedException('Oturum sona erdi, tekrar giriş yapın');
      }
      // Yarış: aynı anahtarla eşzamanlı iki istekten yalnız biri yeniler
      const { count } = await this.prisma.session.updateMany({ where: { id: s.id, replacedAt: null }, data: { replacedAt: new Date(), lastUsedAt: new Date() } });
      if (!count) throw new UnauthorizedException('Oturum sona erdi, tekrar giriş yapın');
      const next = await this.issue(s.user, s.familyId, userAgent ?? s.userAgent ?? undefined);
      return { user: s.user, ...next };
    });
  }

  /** Erişim anahtarındaki oturum ailesi hâlâ açık mı? (AuthGuard, sistem bağlamında çağırır) */
  async isFamilyActive(familyId: string) {
    return (await this.prisma.session.count({ where: { familyId, revokedAt: null } })) > 0;
  }

  async revokeFamily(familyId: string, reason: string) {
    await this.prisma.session.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: reason } });
  }

  /** Kullanıcının açık cihaz oturumları (aile başına en güncel kayıt). */
  async list(userId: string, currentFamilyId?: string) {
    const rows = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, replacedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { familyId: true, userAgent: true, createdAt: true, lastUsedAt: true, expiresAt: true },
    });
    return rows.map(({ familyId, ...r }) => ({ ...r, id: familyId, current: familyId === currentFamilyId }));
  }

  async revokeForUser(tenantId: string, userId: string, familyId: string) {
    const { count } = await this.prisma.session.updateMany({ where: { tenantId, userId, familyId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'user' } });
    if (!count) throw new NotFoundException('Oturum bulunamadı');
  }

  async logout(familyId: string) {
    await this.revokeFamily(familyId, 'logout');
  }
}
