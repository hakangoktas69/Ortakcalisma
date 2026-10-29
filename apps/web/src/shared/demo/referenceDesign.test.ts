import { describe, expect, it } from 'vitest';
import { referencePage, referenceCard, referenceStats, referenceDate } from './referenceDesign.ts';
import { sampleRows } from './model.ts';
describe('8765 ortak ekran tasarım kapsamı', () => {
  it('yalnız karşılığı bulunan ekranları kapsar; 8080 ekleri korunur', () => {
    for (const key of ['genel_bakis.panel', 'firmalar.liste', 'sgk.ebildirge', 'tebligat.liste', 'edefter.liste', 'odeme.online']) expect(referencePage(key)).toBe(true);
    for (const key of ['gorevler', 'notlar', 'bildirimler', 'firmalar.devir', 'firmalar.gib_sozlesmeler', 'yonetim.denetim_kaydi', 'beyanname.senkron', 'bilinmeyen']) expect(referencePage(key)).toBe(false);
    expect(referenceCard('/gorevler')).toBe(false); expect(referenceCard('/notlar')).toBe(false);
    expect(referenceCard('/sgk')).toBe(true); expect(referenceCard('/kategori/gunluk')).toBe(true);
    expect(referenceCard('/yonetim/zamanlama')).toBe(false);
  });
  it('sayaçlar görünür kayıtların gerçek demo durumlarına dayanır ve tarih yalnız sunumda çevrilir', () => {
    const rows = sampleRows('sgk.ebildirge');
    expect(referenceStats(rows)).toEqual([9, 3, 3, 3]);
    expect(referenceStats(rows.slice(0, 2))).toEqual([2, 1, 1, 0]);
    expect(referenceDate('2026-09-10')).toBe('10.09.2026');
    expect(referenceDate('Bilinmiyor')).toBe('Bilinmiyor'); expect(rows[0]?.date).toBe('2026-09-10');
  });
});
