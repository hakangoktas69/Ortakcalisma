import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkSecurity, ConfigError, config, loadConfig, resolveSecretFiles } from './config.js';

const good = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://mukellef_satis:x@localhost:5432/mukellef',
  JWT_SECRET: 'x'.repeat(48),
  VAULT_KEY: Buffer.alloc(32, 1).toString('base64'),
};

describe('satış ayarları', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));

  it('geçerli ayarı varsayılanlarla yükler', () => {
    const c = loadConfig({ ...good });
    expect(c.PORT).toBe(4100);
    expect(config()).toBe(c);
  });
  it('eksik ayarda açılmaz', () => expect(() => loadConfig({ NODE_ENV: 'development' })).toThrow(ConfigError));
  it('üretimde zayıf anahtar ve http adresle açılmaz', () => {
    const r = checkSecurity({ ...loadConfig({ ...good }), NODE_ENV: 'production', JWT_SECRET: 'kisa', WEB_ORIGIN: 'http://x' });
    expect(r.errors.join()).toMatch(/JWT_SECRET/);
    expect(r.errors.join()).toMatch(/https/);
  });
  it('geliştirmede zayıf anahtar yalnız uyarıdır', () => {
    const r = checkSecurity({ ...loadConfig({ ...good }), JWT_SECRET: 'kisa' });
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toMatch(/JWT_SECRET/);
  });
  it('32 bayt olmayan şifreleme anahtarını reddeder', () =>
    expect(() => loadConfig({ ...good, VAULT_KEY: Buffer.alloc(16).toString('base64') })).toThrow(/VAULT_KEY/));
  it('hız sınırı yalnız testte kapatılabilir', () => expect(() => loadConfig({ ...good, RATE_LIMIT: 'off' })).toThrow(/RATE_LIMIT/));
  it('_FILE değişkeninden sır okur, boş dosyayı tanımsız sayar', () => {
    const dir = mkdtempSync(join(tmpdir(), 'satis-'));
    writeFileSync(join(dir, 'jwt'), ' gizli-deger \n');
    writeFileSync(join(dir, 'bos'), '');
    const env: NodeJS.ProcessEnv = { JWT_SECRET_FILE: join(dir, 'jwt'), X_FILE: join(dir, 'bos') };
    resolveSecretFiles(env);
    expect(env.JWT_SECRET).toBe('gizli-deger');
    expect(env.X).toBeUndefined();
  });
});
