import { describe, expect, it } from 'vitest';
import { topluTebligatKarari, type TebligatAdayi } from './tebligat-toplu.ts';
import type { AccountStatus } from '@eworks/credentials';

// "Tüm mükelleflerin e-Tebligatını çek": e-Tebligat her firmanın KENDİ GİB hesabıyla okunur (D45), bu yüzden
// toplu çekim firma başına ayrı iştir. Hangi firmanın işi açılabilir, hangisi neden atlanır — kural burada.

const firma = (id: string, title: string, ek: Partial<TebligatAdayi> = {}): TebligatAdayi => ({
  id,
  title,
  taxId: '4970337300',
  archivedAt: null,
  ...ek,
});

const hesap = (ownerId: string, status: AccountStatus['status'] = 'active'): AccountStatus => ({
  id: `hesap-${ownerId}`,
  ownerKind: 'firm',
  ownerId,
  institution: 'GIB',
  label: '',
  status,
  updatedAt: '2026-10-30T00:00:00Z',
  lastSuccessAt: null,
});

describe('toplu e-Tebligat kararı', () => {
  it('onayı ve GİB hesabı olan firmalar için iş açılır', () => {
    const k = topluTebligatKarari([firma('f1', 'Çınar Ltd.'), firma('f2', 'Deniz Güneş')], new Set(['f1', 'f2']), [hesap('f1'), hesap('f2')]);
    expect(k.acilacak.map((x) => x.id)).toEqual(['f1', 'f2']);
    expect(k.atlanan).toEqual([]);
  });

  it('mükellef onayı yoksa iş açılmaz (D46)', () => {
    const k = topluTebligatKarari([firma('f1', 'Çınar Ltd.')], new Set(), [hesap('f1')]);
    expect(k.acilacak).toEqual([]);
    expect(k.atlanan).toEqual([{ title: 'Çınar Ltd.', neden: 'onay_yok' }]);
  });

  it('GİB hesabı kayıtlı değilse iş açılmaz', () => {
    const k = topluTebligatKarari([firma('f1', 'Çınar Ltd.')], new Set(['f1']), []);
    expect(k.acilacak).toEqual([]);
    expect(k.atlanan).toEqual([{ title: 'Çınar Ltd.', neden: 'hesap_yok' }]);
  });

  it('şifresi hatalı ya da kilitli hesap denenmez (kilitlenme koruması)', () => {
    const k = topluTebligatKarari(
      [firma('f1', 'A Ltd.'), firma('f2', 'B Ltd.'), firma('f3', 'C Ltd.')],
      new Set(['f1', 'f2', 'f3']),
      [hesap('f1', 'wrong_password'), hesap('f2', 'locked'), hesap('f3', 'disabled')],
    );
    expect(k.acilacak).toEqual([]);
    expect(k.atlanan.map((x) => x.neden)).toEqual(['hesap_kullanilamaz', 'hesap_kullanilamaz', 'hesap_kullanilamaz']);
  });

  it('arşivlenmiş firma kapsam dışıdır', () => {
    const k = topluTebligatKarari([firma('f1', 'Eski Ltd.', { archivedAt: '2026-01-01T00:00:00Z' })], new Set(['f1']), [hesap('f1')]);
    expect(k.acilacak).toEqual([]);
    expect(k.atlanan).toEqual([{ title: 'Eski Ltd.', neden: 'arsiv' }]);
  });

  it('yalnız firmanın kendi GİB hesabı kullanılır; müşavir hesabı ya da başka kurum sayılmaz', () => {
    const musavir: AccountStatus = { ...hesap('m1'), ownerKind: 'advisor' };
    const sgk: AccountStatus = { ...hesap('f1'), institution: 'SGK', label: 'Merkez' };
    const k = topluTebligatKarari([firma('f1', 'Çınar Ltd.')], new Set(['f1']), [musavir, sgk]);
    expect(k.acilacak).toEqual([]);
    expect(k.atlanan).toEqual([{ title: 'Çınar Ltd.', neden: 'hesap_yok' }]);
  });

  it('açılacak işte firmanın kimliği ve hesabı taşınır (iş parametreleri)', () => {
    const k = topluTebligatKarari([firma('f1', 'Çınar Ltd.', { taxId: '99674843808' })], new Set(['f1']), [hesap('f1')]);
    expect(k.acilacak[0]).toEqual({ id: 'f1', taxId: '99674843808', hesap: hesap('f1') });
  });

  it('firma yoksa boş karar döner', () => {
    expect(topluTebligatKarari([], new Set(), [])).toEqual({ acilacak: [], atlanan: [] });
  });
});
