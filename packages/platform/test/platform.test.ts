import { describe, expect, it } from 'vitest';
import { checksum, databaseSchema, loadConfig, parseShardUrls, plan, sessionSchema, type MigrationFile } from '../src/index.ts';

const f = (name: string, sql = `-- ${name}`): MigrationFile => ({ name, sql, checksum: checksum(sql) });

describe('migration planı', () => {
  it('uygulanmamışları ad sırasıyla seçer', () => {
    const files = [f('0001_a.sql'), f('0002_b.sql'), f('0003_c.sql')];
    expect(plan(files, [{ name: '0001_a.sql', checksum: files[0]!.checksum }]).map((x) => x.name)).toEqual(['0002_b.sql', '0003_c.sql']);
  });

  it('uygulanmış dosya değişmişse ya da silinmişse durur', () => {
    expect(() => plan([f('0001_a.sql', 'yeni')], [{ name: '0001_a.sql', checksum: checksum('eski') }])).toThrow(/değiştirilmiş/);
    expect(() => plan([], [{ name: '0001_a.sql', checksum: 'x' }])).toThrow(/depoda yok/);
  });

  it('satır sonu farkı özeti değiştirmez (Windows çalışma ağacı)', () => {
    expect(checksum('a\r\nb')).toBe(checksum('a\nb'));
  });
});

describe('yapılandırma', () => {
  const base = {
    AUTH_URL: 'http://auth:9999',
    JWT_SECRET: 'x'.repeat(40),
    SESSION_SECRET: 'y'.repeat(40),
    REDIS_URL: 'redis://redis:6379',
  };

  it('shard listesini ayrıştırır', () => {
    expect([...parseShardUrls('shard-01=postgres://a, shard-02=postgres://b')]).toEqual([
      ['shard-01', 'postgres://a'],
      ['shard-02', 'postgres://b'],
    ]);
    expect(() => parseShardUrls('')).toThrow(/en az bir shard/i);
    expect(() => parseShardUrls('postgres://a')).toThrow(/biçimi/);
    expect(loadConfig(databaseSchema, { CONTROL_DATABASE_URL: 'postgres://c', SHARD_DATABASE_URLS: 'shard-01=postgres://s' }).SHARD_DATABASE_URLS.size).toBe(1);
  });

  it('kısa ya da varsayılan sırrı reddeder, hata mesajında değeri vermez', () => {
    expect(() => loadConfig(sessionSchema, { ...base, JWT_SECRET: 'kisa-sir' })).toThrow(/JWT_SECRET: en az 32/);
    try {
      loadConfig(sessionSchema, { ...base, JWT_SECRET: 'kisa-sir' });
    } catch (err) {
      expect((err as Error).message).not.toContain('kisa-sir');
    }
  });

  it('üretimde güvensiz çerezle açılmaz', () => {
    expect(loadConfig(sessionSchema, { ...base, COOKIE_SECURE: 'false', EWORKS_ORTAM: 'demo' }).COOKIE_SECURE).toBe(false);
    expect(() => loadConfig(sessionSchema, { ...base, COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/);
    expect(() => loadConfig(sessionSchema, { ...base, COOKIE_SECURE: 'false', EWORKS_ORTAM: 'uretim' })).toThrow(/COOKIE_SECURE/);
    expect(loadConfig(sessionSchema, base).COOKIE_SECURE).toBe(true);
  });
});
