import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { ACCESS_TTL_SECONDS, SalesAuthService } from '../../application/auth.service.js';
import { config } from '../../config.js';

/**
 * Oturum HttpOnly çerezde: tarayıcı betikleri anahtarı okuyamaz (localStorage'da token yok).
 * SameSite=Strict + yalnız /api/satis yolu: çerez başka sitelerden gelen isteklerle gönderilmez,
 * müşavir sitesinin isteklerine de karışmaz.
 */
export const SESSION_COOKIE = 'satis_oturum';
const COOKIE_PATH = '/api/satis';

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config().NODE_ENV === 'production',
    sameSite: 'strict',
    path: COOKIE_PATH,
    maxAge: ACCESS_TTL_SECONDS * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: config().NODE_ENV === 'production', sameSite: 'strict', path: COOKIE_PATH });
}

export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

/**
 * CSRF: veri değiştiren istekte özel başlık (X-Satis: 1) zorunlu ve Origin varsa satış ekranının adresi olmalı.
 * Başka bir site bu başlığı CORS izni olmadan gönderemez; API CORS'a izin vermez.
 */
export function csrfGuard(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (req.headers['x-satis'] !== '1' || (origin && origin !== config().WEB_ORIGIN)) {
    res.status(403).json({ statusCode: 403, message: 'İstek reddedildi' });
    return;
  }
  next();
}

export interface SalesUserCtx {
  id: string;
  email: string;
  fullName: string;
  mustChangePassword: boolean;
}

type SalesRequest = Request & { salesUser?: SalesUserCtx };

const PUBLIC = 'satis:public';
const TEMP_PASSWORD_OK = 'satis:temp-password-ok';

/** Oturumsuz uç (giriş adımları). */
export const Public = () => SetMetadata(PUBLIC, true);
/** Geçici şifreyle de çağrılabilir (şifre değiştirme, kim olduğum, çıkış). */
export const AllowTempPassword = () => SetMetadata(TEMP_PASSWORD_OK, true);

export const CurrentSalesUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const u = ctx.switchToHttp().getRequest<SalesRequest>().salesUser;
  if (!u) throw new UnauthorizedException();
  return u;
});

/** Varsayılan olarak her uç oturum ister (APP_GUARD). Geçici şifreli kullanıcı yalnız şifre değiştirebilir. */
@Injectable()
export class SalesSessionGuard implements CanActivate {
  constructor(
    private readonly auth: SalesAuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const meta = (key: string) => this.reflector.getAllAndOverride<boolean>(key, [ctx.getHandler(), ctx.getClass()]);
    if (meta(PUBLIC)) return true;
    const req = ctx.switchToHttp().getRequest<SalesRequest>();
    const token = readCookie(req, SESSION_COOKIE);
    const u = token ? await this.auth.authenticate(token) : null;
    if (!u) throw new UnauthorizedException('Oturum açın');
    if (u.mustChangePassword && !meta(TEMP_PASSWORD_OK)) {
      throw new ForbiddenException({ statusCode: 403, code: 'PASSWORD_CHANGE_REQUIRED', message: 'Önce geçici şifrenizi değiştirin' });
    }
    req.salesUser = { id: u.id, email: u.email, fullName: u.fullName, mustChangePassword: u.mustChangePassword };
    return true;
  }
}
