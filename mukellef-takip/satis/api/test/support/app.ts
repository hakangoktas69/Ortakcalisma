import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { inject } from 'vitest';
import { loadConfig } from '../../src/config.js';
import { configureApp } from '../../src/configure-app.js';
import { generateSecret, hashPassword, PrismaClient, VaultService, localKeyRing } from '../../src/core.js';
import { base32Decode, hotp, stepAt } from '../../../../apps/api/src/modules/identity/domain/totp.js';
import './global-setup.js';

export const WEB_ORIGIN = 'http://localhost:3100';
/** Veri değiştiren isteklerde satış ekranının gönderdiği başlıklar (CSRF) */
export const CSRF = { 'X-Satis': '1', Origin: WEB_ORIGIN };

export interface TestApp {
  app: NestExpressApplication;
  /** Tablo sahibi bağlantısı (RLS dışı): veri hazırlama ve kontrol */
  db: PrismaClient;
  /** Çerezleri saklayan yeni bir istemci (ayrı tarayıcı gibi) */
  agent: () => ReturnType<typeof request.agent>;
  http: () => ReturnType<typeof request>;
  vault: VaultService;
  close: () => Promise<void>;
}

export const stack = () => inject('satis');

export async function bootApp(): Promise<TestApp> {
  const s = stack();
  const c = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: s.satisRoleUrl,
    JWT_SECRET: s.jwtSecret,
    VAULT_KEY: s.vaultKey,
    WEB_ORIGIN,
    RATE_LIMIT: 'off',
  });
  const { AppModule } = await import('../../src/app.module.js');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
  configureApp(app, c);
  await app.init();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: s.adminUrl }) });
  return {
    app,
    db,
    agent: () => request.agent(app.getHttpServer()),
    http: () => request(app.getHttpServer()),
    vault: new VaultService(localKeyRing(s.vaultKey)),
    close: async () => {
      await app.close();
      await db.$disconnect();
    },
  };
}

/** Doğrulayıcı uygulamanın o anda göstereceği kod */
export const totpNow = (secret: string) => hotp(base32Decode(secret), stepAt(Date.now()));

export interface Member {
  id: string;
  email: string;
  password: string;
  secret: string;
}

/** 2FA'sı kurulu, şifresini değiştirmiş satış kullanıcısı (doğrudan veritabanına). */
export async function createMember(t: TestApp, email: string, opts: { mustChangePassword?: boolean } = {}): Promise<Member> {
  const password = 'Satis-Test-2026';
  const secret = generateSecret();
  const u = await t.db.salesUser.create({
    data: {
      email,
      fullName: email.split('@')[0],
      passwordHash: await hashPassword(password),
      mustChangePassword: opts.mustChangePassword ?? false,
      totpSecretEnc: t.vault.encrypt(secret),
      totpEnabledAt: new Date(),
    },
  });
  return { id: u.id, email, password, secret };
}

/** Şifre + kod ile giriş yapmış istemci. Aynı 30 sn içinde tekrar giriş için kullanılan adım sıfırlanır. */
export async function signIn(t: TestApp, m: Member) {
  await t.db.salesUser.update({ where: { id: m.id }, data: { totpLastStep: null } });
  const agent = t.agent();
  const step = await agent.post('/api/satis/auth/login').set(CSRF).send({ email: m.email, password: m.password }).expect(200);
  if (step.body.step !== 'mfa') throw new Error(`beklenmeyen adım: ${step.body.step}`);
  await agent.post('/api/satis/auth/login/2fa').set(CSRF).send({ token: step.body.token, code: totpNow(m.secret) }).expect(200);
  return agent;
}
