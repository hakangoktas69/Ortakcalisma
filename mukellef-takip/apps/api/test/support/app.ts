import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { inject } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { loadConfig } from '../../src/platform/config/config.js';
import { configureApp } from '../../src/platform/http/configure-app.js';
import './stack-info.js';

/**
 * Bir test dosyası için gerçek API uygulaması (üretimle aynı kurulum: configureApp) ve yardımcılar.
 * Uygulama RLS'e tabi rolle bağlanır; dış servisler demo modunda.
 */
export interface TestApp {
  app: NestExpressApplication;
  /** Tablo sahibi bağlantısı: durum kontrolü ve test verisi hazırlığı için (RLS dışı) */
  db: PrismaClient;
  http: () => ReturnType<typeof request>;
  /** E-posta/şifreyle giriş; Authorization başlığı ve anahtarları döner */
  login: (email: string, password: string) => Promise<Session>;
  close: () => Promise<void>;
}

export interface Session {
  access: string;
  refresh: string;
  auth: { Authorization: string };
}

export function stack() {
  return inject('stack');
}

export async function bootApp(env: Record<string, string> = {}): Promise<TestApp> {
  const s = stack();
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: s.appRoleUrl,
    REDIS_URL: s.redisUrl,
    JWT_SECRET: s.jwtSecret,
    VAULT_KEY: s.vaultKey,
    SGK_MODE: 'mock',
    GIB_MODE: 'mock',
    WHATSAPP_MODE: 'mock',
    PASSWORD_RESET_MODE: 'mock',
    // Güvenlik kodu ayrı dosyada (captcha.e2e-spec.ts) açık olarak sınanır
    CAPTCHA_MODE: 'off',
    BILLING_PROVIDER: 'demo',
    ASSISTANT_MODE: 'mock',
    LOG_LEVEL: 'error',
    // Hız sınırı ayrı testte (throttle.e2e-spec.ts) açık olarak sınanır
    RATE_LIMIT: 'off',
    ...env,
  });
  const config = loadConfig(process.env, () => {});
  const { AppModule } = await import('../../src/app.module.js');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
  configureApp(app, config);
  await app.init();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: s.adminUrl }) });
  const http = () => request(app.getHttpServer());
  const login = async (email: string, password: string): Promise<Session> => {
    const res = await http().post('/api/auth/login').send({ email, password });
    if (res.status !== 201 || !res.body.accessToken) throw new Error(`Giriş başarısız (${res.status}): ${JSON.stringify(res.body)}`);
    return { access: res.body.accessToken, refresh: res.body.refreshToken, auth: { Authorization: `Bearer ${res.body.accessToken}` } };
  };
  return {
    app,
    db,
    http,
    login,
    close: async () => {
      await app.close();
      await db.$disconnect();
    },
  };
}

/** Yanıt gövdesinde kişisel veri sızıntısı kontrolü: tam T.C. kimlik no (11 hane) olmamalı. */
export function expectNoFullTckn(body: unknown) {
  const text = JSON.stringify(body);
  const m = text.match(/"tckn":"(\d{11})"/);
  if (m) throw new Error(`Yanıtta maskelenmemiş T.C. kimlik no var: ${m[1].slice(0, 3)}…`);
}
