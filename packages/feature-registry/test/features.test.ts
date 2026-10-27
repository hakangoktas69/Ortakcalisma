import { describe, expect, it } from 'vitest';
import { childrenOf, computeStatus, contextOf, featureTags, features, LIVE_ACTIONS, liveVerifications, parentOf } from '../src/index.ts';

describe('özellik ağacı', () => {
  const keys = Object.keys(features);

  it('her düğümün üstü ağaçta var, anahtarlar biçime uyuyor', () => {
    for (const k of keys) {
      expect(k).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/);
      const p = parentOf(k);
      if (p) expect(features[p], `${k} için üst düğüm ${p}`).toBeDefined();
    }
  });

  it('modül kökte, işlem yaprakta; işlemlerin kabul testi gerekir', () => {
    for (const k of keys) {
      const f = features[k]!;
      if (f.kind === 'module') expect(parentOf(k)).toBeNull();
      if (f.kind === 'action') {
        expect(childrenOf(features, k)).toEqual([]);
        expect(f.acceptance).toBe(true);
      } else {
        expect(childrenOf(features, k).length, `${k} boş`).toBeGreaterThan(0);
      }
    }
  });

  it('05 §3.1 yetki ağacındaki anahtarlar kayıtta', () => {
    for (const k of [
      'firmalar.liste.view', 'firmalar.kart.archive', 'firmalar.kurum_hesaplari.grant_use',
      'beyanname.liste.export', 'beyanname.belge.download', 'beyanname.senkron.start',
      'sgk.kontrol.view', 'sgk.ebildirge.sync', 'sgk.ise_giris_cikis.sync', 'sgk.erapor.approve', 'sgk.is_kazasi.view',
      'gorevler.assign', 'yonetim.kullanicilar.edit_permissions', 'yonetim.zamanlama.edit',
      'yonetim.belge_temizligi.run', 'yonetim.hiz_politikasi.edit',
    ]) expect(features[k], k).toBeDefined();
  });

  it('bağlam miras alınır, sayfa ezebilir', () => {
    expect(contextOf(features, 'sgk.erapor.approve')).toBe('social-security');
    expect(contextOf(features, 'firmalar.kurum_hesaplari.consent')).toBe('credentials');
    expect(contextOf(features, 'tebligat.liste.view')).toBe('notices'); // D45
    expect(contextOf(features, 'edefter.liste.view')).toBeNull();
  });

  it('test sonucu yokken her düğüm kırmızı başlar', () => {
    const s = computeStatus(features, []);
    expect(Object.values(s).every((n) => n.status === 'red')).toBe(true);
    expect(s['sgk']).toMatchObject({ green: 0, total: 11 });
  });
});

describe('durum hesabı', () => {
  const tree = {
    sgk: { title: 'SGK', kind: 'module' },
    'sgk.ebildirge': { title: 'e-Bildirge', kind: 'page' },
    'sgk.ebildirge.view': { title: 'Görüntüle', kind: 'action', acceptance: true },
    'sgk.ebildirge.sync': { title: 'Güncelle', kind: 'action', acceptance: true },
  } as const;

  it('tüm testleri geçen işlem yeşil, biri kırmızıysa üst düğüm kırmızı ve ilerleme gösterir', () => {
    const s = computeStatus(tree, [
      { feature: 'sgk.ebildirge.view', passed: true, acceptance: true },
      { feature: 'sgk.ebildirge.sync', passed: true, acceptance: true },
      { feature: 'sgk.ebildirge.sync', passed: false, acceptance: true },
    ]);
    expect(s['sgk.ebildirge.view']).toEqual({ status: 'green', green: 1, total: 1, tests: 1 });
    expect(s['sgk.ebildirge.sync']?.status).toBe('red');
    expect(s['sgk']).toEqual({ status: 'red', green: 1, total: 2, tests: 3 });
  });

  it('kabul testi olmadan (yalnız birim testi) işlem yeşil olmaz', () => {
    expect(computeStatus(tree, [{ feature: 'sgk.ebildirge.view', passed: true }])['sgk.ebildirge.view']?.status).toBe('red');
  });

  it('tüm işlemler yeşilse modül yeşil', () => {
    const s = computeStatus(tree, [
      { feature: 'sgk.ebildirge.view', passed: true, acceptance: true },
      { feature: 'sgk.ebildirge.sync', passed: true, acceptance: true },
    ]);
    expect(s['sgk']?.status).toBe('green');
  });

  it('etiketleri test adından okur', () => {
    expect(featureTags('[F:sgk.ebildirge.sync] e-Bildirge toplu')).toEqual(['sgk.ebildirge.sync']);
    expect(featureTags('@F:sgk.erapor.view @F:sgk.kontrol.view listeler')).toEqual(['sgk.erapor.view', 'sgk.kontrol.view']);
    expect(featureTags('etiketsiz')).toEqual([]);
  });
});

describe('canlı doğrulama (D33)', () => {
  const tree = {
    gib: { title: 'GİB', kind: 'module' },
    'gib.sozlesme': { title: 'Sözleşmeler', kind: 'page' },
    'gib.sozlesme.view': { title: 'Görüntüle', kind: 'action', acceptance: true },
    'gib.sozlesme.sync': { title: 'Güncelle', kind: 'action', acceptance: true, live: true },
  } as const;
  const results = [
    { feature: 'gib.sozlesme.view', passed: true, acceptance: true },
    { feature: 'gib.sozlesme.sync', passed: true, acceptance: true },
  ];
  const kayit = { anahtar: 'gib.sozlesme.sync', tarih: '2026-10-25', kim: 'test', sonuc: '3 sözleşme', surum: 'abc1234' };

  it('kurumla konuşan işlem sahte kurum testleri geçse de kayıt olmadan kırmızı', () => {
    expect(computeStatus(tree, results)['gib.sozlesme.sync']?.status).toBe('red');
    expect(computeStatus(tree, results)['gib.sozlesme.view']?.status).toBe('green');
  });

  it('canlı kayıt + yeşil testler → yeşil; testler kırmızıysa kayıt yetmez', () => {
    expect(computeStatus(tree, results, [kayit])['gib']?.status).toBe('green');
    expect(computeStatus(tree, [{ feature: 'gib.sozlesme.sync', passed: false, acceptance: true }], [kayit])['gib.sozlesme.sync']?.status).toBe('red');
  });

  it('kayıtlı anahtarlar ağaçta var ve kurumla konuşan işleme ait', () => {
    for (const l of liveVerifications) {
      expect(features[l.anahtar]?.live, l.anahtar).toBe(true);
      expect(l.tarih).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(l.surum).toMatch(/^[0-9a-f]{7,40}$/);
    }
    for (const k of LIVE_ACTIONS) expect(features[k]?.live, k).toBe(true);
  });
});
