import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiTokenService, TOKEN_PREFIX } from './api-token.service.js';
import { PrismaService } from '../prisma.service.js';
import { verifySession, type AuthUser } from './auth.guard.js';

/**
 * GİB sayfası aktarma uç noktası için: normal oturum (JWT) VEYA "gib:import" yetkili
 * eklenti anahtarı kabul edilir. Eklenti anahtarı başka hiçbir uç noktada geçmez.
 */
@Injectable()
export class ImportGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly tokens: ApiTokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();

    if (token.startsWith(TOKEN_PREFIX)) {
      const owner = await this.tokens.verify(token, ['gib:import', 'declarations:import']);
      if (!owner) throw new UnauthorizedException('Eklenti anahtarı geçersiz veya iptal edilmiş');
      req.user = { sub: owner.userId, tenantId: owner.tenantId, role: 'STAFF', sv: -1, tokenId: owner.tokenId } satisfies AuthUser & {
        tokenId: string;
      };
      return true;
    }
    req.user = await verifySession(this.jwt, this.prisma, token, req.originalUrl ?? req.url);
    return true;
  }
}
