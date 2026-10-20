import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config.js';

const KEY = Buffer.alloc(32, 7).toString('base64');
const STRONG = 'x'.repeat(16) + 'Y3k9pQ2mZ7vR1tW8';
const base = (over: Record<string, string> = {}): NodeJS.ProcessEnv => ({
  DATABASE_URL: 'postgresql://u:p@db/x',
  JWT_SECRET: STRONG,
  VAULT_KEY: KEY,
  ...over,
});
const quiet = () => {};

describe('loadConfig', () => {
  it('geliştirmede varsayılanları doldurur ve env e yazar', () => {
    const env = base();
    const c = loadConfig(env, quiet);
    expect(c.SGK_MODE).toBe('mock');
    expect(env.SGK_MODE).toBe('mock');
    expect(c.PORT).toBe(4000);
  });

  it('geliştirmede zayıf JWT_SECRET yalnız uyarı verir', () => {
    const warnings: string[] = [];
    loadConfig(base({ JWT_SECRET: 'degistirin' }), (m) => warnings.push(m));
    expect(warnings.join()).toMatch(/JWT_SECRET zayıf/);
  });

  it('üretimde zayıf JWT_SECRET ile açılmaz', () => {
    expect(() =>
      loadConfig(base({ NODE_ENV: 'production', JWT_SECRET: 'degistirin', DEMO_MODE: 'true', WEB_ORIGIN: 'https://a', API_PUBLIC_URL: 'https://a/api' }), quiet),
    ).toThrow(ConfigError);
  });

  it('üretimde demo ödeme sağlayıcısını reddeder', () => {
    expect(() =>
      loadConfig(base({ NODE_ENV: 'production', KMS_PROVIDER: 'openbao', OPENBAO_ADDR: 'http://bao', OPENBAO_TOKEN: 't', OPENBAO_WRAPPED_DEK: 'vault:v1:x', WEB_ORIGIN: 'https://a', API_PUBLIC_URL: 'https://a/api' }), quiet),
    ).toThrow(/BILLING_PROVIDER=demo/);
  });

  it('VAULT_KEY boyutu yanlışsa açılmaz', () => {
    expect(() => loadConfig(base({ VAULT_KEY: Buffer.alloc(16).toString('base64') }), quiet)).toThrow(/32 bayt/);
  });

  it('X_FILE ile sırrı dosyadan okur (Docker secrets)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cfg-'));
    writeFileSync(join(dir, 'jwt'), STRONG + '\n');
    const env = base();
    delete env.JWT_SECRET;
    env.JWT_SECRET_FILE = join(dir, 'jwt');
    expect(loadConfig(env, quiet).JWT_SECRET).toBe(STRONG);
  });
});

describe('boş değerler', () => {
  it('boş string tanımsız sayılır (compose ${X:-})', () => {
    const c = loadConfig(base({ EXTENSION_ID: '', SGK_MODE: '' }), quiet);
    expect(c.EXTENSION_ID).toBeUndefined();
    expect(c.SGK_MODE).toBe('mock');
  });
});

describe('hız sınırı', () => {
  it('RATE_LIMIT=off yalnız test ortamında kabul edilir', () => {
    expect(loadConfig(base({ NODE_ENV: 'test', RATE_LIMIT: 'off' }), quiet).RATE_LIMIT).toBe('off');
    expect(() => loadConfig(base({ RATE_LIMIT: 'off' }), quiet)).toThrow(/RATE_LIMIT=off/);
  });
});
