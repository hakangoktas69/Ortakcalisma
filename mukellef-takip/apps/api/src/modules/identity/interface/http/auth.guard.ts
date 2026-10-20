import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../../platform/database/prisma.service.js';
import { runAsSystem, setCurrentTenant } from '../../../../platform/database/tenant-context.js';

export interface AuthUser {
  sub: string;
  tenantId: string;
  role: 'ADMIN' | 'STAFF';
  /** Oturum sürümü: kullanıcının sessionVersion'ı artınca eski token'lar geçersizleşir. */
  sv: number;
  purpose?: 'access' | 'mfa';
  /** Oturum ailesi (Session.familyId): çıkış veya uzaktan sonlandırmada bu erişim anahtarı da düşer. */
  fid?: string;
}

// Şifre değişikliği zorunlu kullanıcı sadece bu uçlara erişebilir
const ALLOWED_WHEN_PASSWORD_CHANGE_REQUIRED = ['/api/auth/me', '/api/auth/password'];
// Büroda 2FA zorunluysa ve kullanıcı henüz kurmadıysa sadece kurulum uçlarına erişebilir
const ALLOWED_WHEN_2FA_REQUIRED = ['/api/auth/me', '/api/auth/password', '/api/auth/2fa/setup', '/api/auth/2fa/enable'];

/**
 * Oturum JWT'sini doğrular ve her istekte kullanıcının hâlâ aktif olduğunu, oturum sürümünün
 * güncel olduğunu kontrol eder. Böylece devre dışı bırakma, şifre değişikliği ve 2FA değişikliği
 * mevcut oturumları anında sonlandırır.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();
    req.user = await verifySession(this.jwt, this.prisma, token, req.originalUrl ?? req.url);
    // Bundan sonraki bütün sorgular yalnız bu büronun satırlarını görür (RLS)
    setCurrentTenant(req.user.tenantId);
    return true;
  }
}

export async function verifySession(jwt: JwtService, prisma: PrismaService, token: string, url: string): Promise<AuthUser> {
  let payload: AuthUser;
  try {
    payload = await jwt.verifyAsync<AuthUser>(token);
  } catch {
    throw new UnauthorizedException();
  }
  if (payload.purpose === 'mfa') throw new UnauthorizedException(); // 2FA ara token'ı oturum değildir
  // Büro henüz doğrulanmadı: oturum kontrolü sistem bağlamında, yalnız bu kullanıcıya bakar
  const user = await runAsSystem(() => prisma.user.findUnique({
    where: { id: payload.sub },
    select: { isActive: true, sessionVersion: true, mustChangePassword: true, role: true, tenantId: true, totpEnabledAt: true, tenant: { select: { require2fa: true } } },
  }));
  if (!user || !user.isActive || user.sessionVersion !== payload.sv || user.tenantId !== payload.tenantId) {
    throw new UnauthorizedException('Oturum sona erdi, tekrar giriş yapın');
  }
  if (payload.fid && !(await runAsSystem(() => prisma.session.count({ where: { familyId: payload.fid, revokedAt: null } })))) {
    throw new UnauthorizedException('Oturum sona erdi, tekrar giriş yapın');
  }
  const path = url.split('?')[0];
  if (user.mustChangePassword && !ALLOWED_WHEN_PASSWORD_CHANGE_REQUIRED.includes(path)) {
    throw new ForbiddenException({ message: 'Devam etmek için şifrenizi değiştirin', code: 'PASSWORD_CHANGE_REQUIRED' });
  }
  if (user.tenant.require2fa && !user.totpEnabledAt && !ALLOWED_WHEN_2FA_REQUIRED.includes(path)) {
    throw new ForbiddenException({ message: 'Büronuzda iki adımlı doğrulama zorunlu; devam etmek için kurun', code: 'TWO_FACTOR_REQUIRED' });
  }
  // Rol, token'dan değil veritabanından: rol değişikliği anında geçerli olur
  return { ...payload, role: user.role };
}

/** Sadece yöneticilerin erişebileceği uçlar için (AuthGuard'dan SONRA kullanılır). */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const user = ctx.switchToHttp().getRequest().user as AuthUser | undefined;
    if (user?.role !== 'ADMIN') throw new ForbiddenException('Bu işlem için yönetici yetkisi gerekir');
    return true;
  }
}

// Her sorgu bu tenantId ile filtrelenir; bir büro diğerinin verisini göremez.
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
