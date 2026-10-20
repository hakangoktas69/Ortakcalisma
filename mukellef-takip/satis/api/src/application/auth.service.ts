import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import QRCode from 'qrcode';
import {
  dummyHash,
  generateRecoveryCodes,
  generateSecret,
  hashPassword,
  hashRecoveryCode,
  needsRehash,
  otpauthUri,
  VaultService,
  verifyPassword,
  verifyTotp,
} from '../core.js';
import { afterFailure, isLocked } from '../domain/login-lock.js';
import { passwordProblem } from '../domain/password.js';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { SalesAuditService } from '../infrastructure/audit.service.js';

/** Satış oturum anahtarının içeriği. purpose: ara adım (mfa/setup) anahtarı oturum yerine kullanılamaz. */
export interface SalesToken {
  sub: string;
  sv: number;
  purpose: 'access' | 'mfa' | 'setup';
}

export const ACCESS_TTL_SECONDS = 8 * 60 * 60;

/** Giriş adımı: kod iste (2FA kurulu) ya da kurulum ekranını aç (ilk giriş, 2FA zorunlu). */
export type LoginStep = { step: 'mfa' | 'setup'; token: string };

const INVALID = 'E-posta veya şifre hatalı';

@Injectable()
export class SalesAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly vault: VaultService,
    private readonly audit: SalesAuditService,
  ) {}

  async login(email: string, password: string): Promise<LoginStep> {
    const u = await this.prisma.salesUser.findUnique({ where: { email: email.trim().toLowerCase() } });
    // Kullanıcı yoksa da özet doğrula: yanıt süresinden e-postanın kayıtlı olduğu anlaşılmasın
    if (!u) {
      await verifyPassword(await dummyHash(), password);
      throw new UnauthorizedException(INVALID);
    }
    if (isLocked(u.lockedUntil)) throw new UnauthorizedException('Çok sayıda hatalı deneme: hesap 15 dakika kilitli');
    if (!(await verifyPassword(u.passwordHash, password)) || !u.isActive) {
      const next = afterFailure(u.failedLogins);
      await this.prisma.salesUser.update({ where: { id: u.id }, data: next });
      if (next.lockedUntil) await this.audit.log({ salesUserId: u.id, action: 'sales.login.locked', target: u.id });
      throw new UnauthorizedException(INVALID);
    }
    await this.prisma.salesUser.update({
      where: { id: u.id },
      data: { failedLogins: 0, lockedUntil: null, ...(needsRehash(u.passwordHash) ? { passwordHash: await hashPassword(password) } : {}) },
    });
    const purpose = u.totpEnabledAt ? 'mfa' : 'setup';
    const token = await this.jwt.signAsync({ sub: u.id, sv: u.sessionVersion, purpose } satisfies SalesToken, {
      expiresIn: purpose === 'mfa' ? '5m' : '15m',
    });
    return { step: purpose, token };
  }

  /** Ara adım anahtarını doğrular ve kullanıcıyı getirir. */
  private async stepUser(token: string, purpose: 'mfa' | 'setup') {
    let p: SalesToken;
    try {
      p = await this.jwt.verifyAsync<SalesToken>(token);
    } catch {
      throw new UnauthorizedException('Giriş adımının süresi doldu, yeniden giriş yapın');
    }
    if (p.purpose !== purpose) throw new UnauthorizedException();
    const u = await this.prisma.salesUser.findUnique({ where: { id: p.sub } });
    if (!u || !u.isActive || u.sessionVersion !== p.sv) throw new UnauthorizedException();
    return u;
  }

  /** 2. adım: doğrulayıcı kodu ya da tek kullanımlık kurtarma kodu. */
  async secondFactor(token: string, code?: string, recoveryCode?: string) {
    const u = await this.stepUser(token, 'mfa');
    if (!u.totpSecretEnc || !u.totpEnabledAt) throw new UnauthorizedException();
    if (recoveryCode) {
      const h = hashRecoveryCode(recoveryCode);
      if (!u.recoveryCodeHashes.includes(h)) throw new UnauthorizedException('Kurtarma kodu geçersiz');
      await this.prisma.salesUser.update({ where: { id: u.id }, data: { recoveryCodeHashes: u.recoveryCodeHashes.filter((x) => x !== h) } });
      await this.audit.log({ salesUserId: u.id, action: 'sales.login.recovery-code', target: u.id });
    } else {
      const step = verifyTotp(this.vault.decrypt(u.totpSecretEnc), code ?? '', Date.now(), u.totpLastStep);
      if (step === null) throw new UnauthorizedException('Kod hatalı');
      await this.prisma.salesUser.update({ where: { id: u.id }, data: { totpLastStep: step } });
    }
    return this.complete(u.id);
  }

  /** İlk giriş: doğrulayıcı uygulama için yeni gizli anahtar (kod onaylanana kadar etkin değil). */
  async setup(token: string) {
    const u = await this.stepUser(token, 'setup');
    if (u.totpEnabledAt) throw new BadRequestException('İki adımlı doğrulama zaten açık');
    const secret = generateSecret();
    await this.prisma.salesUser.update({ where: { id: u.id }, data: { totpSecretEnc: this.vault.encrypt(secret) } });
    const uri = otpauthUri(secret, u.email, 'Mükellef Takip Satış');
    return { secret, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
  }

  /** Kurulumu kodla onaylar; kurtarma kodları yalnız bu yanıtta bir kez gösterilir. */
  async enable(token: string, code: string) {
    const u = await this.stepUser(token, 'setup');
    if (u.totpEnabledAt) throw new BadRequestException('İki adımlı doğrulama zaten açık');
    if (!u.totpSecretEnc) throw new BadRequestException('Önce kurulumu başlatın');
    const step = verifyTotp(this.vault.decrypt(u.totpSecretEnc), code);
    if (step === null) throw new BadRequestException('Kod hatalı; telefonunuzdaki güncel kodu girin');
    const recoveryCodes = generateRecoveryCodes();
    await this.prisma.salesUser.update({
      where: { id: u.id },
      data: { totpEnabledAt: new Date(), totpLastStep: step, recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode) },
    });
    await this.audit.log({ salesUserId: u.id, action: 'sales.2fa.enable', target: u.id });
    return { ...(await this.complete(u.id)), recoveryCodes };
  }

  private async complete(id: string) {
    const u = await this.prisma.salesUser.update({ where: { id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({ salesUserId: u.id, action: 'sales.login', target: u.id });
    return { accessToken: await this.accessToken(u), mustChangePassword: u.mustChangePassword };
  }

  accessToken(u: { id: string; sessionVersion: number }) {
    return this.jwt.signAsync({ sub: u.id, sv: u.sessionVersion, purpose: 'access' } satisfies SalesToken, { expiresIn: ACCESS_TTL_SECONDS });
  }

  /** Oturum anahtarını doğrular; kullanıcı kapatıldıysa ya da şifresi/2FA'sı değiştiyse geçersizdir. */
  async authenticate(token: string) {
    let p: SalesToken;
    try {
      p = await this.jwt.verifyAsync<SalesToken>(token);
    } catch {
      return null;
    }
    if (p.purpose !== 'access') return null;
    const u = await this.prisma.salesUser.findUnique({
      where: { id: p.sub },
      select: { id: true, email: true, fullName: true, isActive: true, sessionVersion: true, totpEnabledAt: true, mustChangePassword: true },
    });
    if (!u || !u.isActive || !u.totpEnabledAt || u.sessionVersion !== p.sv) return null;
    return u;
  }

  /** Şifre değişince diğer cihazlardaki oturumlar düşer; bu cihaz için yeni anahtar döner. */
  async changePassword(userId: string, current: string, next: string) {
    const u = await this.prisma.salesUser.findUniqueOrThrow({ where: { id: userId } });
    if (!(await verifyPassword(u.passwordHash, current))) throw new BadRequestException('Mevcut şifre hatalı');
    const problem = passwordProblem(next);
    if (problem) throw new BadRequestException(problem);
    if (current === next) throw new BadRequestException('Yeni şifre eskisiyle aynı olamaz');
    const updated = await this.prisma.salesUser.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(next), mustChangePassword: false, sessionVersion: { increment: 1 } },
    });
    await this.audit.log({ salesUserId: userId, action: 'sales.password.change', target: userId });
    return this.accessToken(updated);
  }
}
