import { Injectable } from '@nestjs/common';
import {
  EXIT_REASONS,
  TescilError,
  type TescilClient,
  type TescilCredentials,
  type TescilRecord,
} from '../../application/ports/tescil.types.js';

const firstNames = ['Ahmet', 'Ayşe', 'Mehmet', 'Fatma', 'Ali', 'Zeynep', 'Emre', 'Elif', 'Can', 'Selin'];
const lastNames = ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Aydın', 'Arslan', 'Doğan', 'Kurt', 'Öz'];
const exitCodes = Object.keys(EXIT_REASONS);

/**
 * SGK'ya bağlanmayan demo 4A istemcisi (SGK_MODE=mock).
 * Kullanıcı adına göre deterministik kayıtlar üretir; aynı aralık her sorguda aynı sonucu döner.
 * Sistem şifresi "hatali" ise giriş hatası taklit edilir.
 */
@Injectable()
export class MockTescilClient implements TescilClient {
  readonly mode = 'mock' as const;

  async verify(c: TescilCredentials) {
    if (!c.sistemSifresi || c.sistemSifresi === 'hatali') {
      throw new TescilError('AUTH', 'Kullanıcı adı, sistem şifresi veya işyeri şifresi hatalı');
    }
  }

  private generate(c: TescilCredentials, from: Date, to: Date, kind: 'entry' | 'exit'): TescilRecord[] {
    // FNV-1a: harf sırası da hesaba katılır ("demo0-1" ile "demo1-0" farklı seed üretir)
    let seed = 2166136261;
    for (const ch of c.kullaniciAdi) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
    seed %= 100_000;
    const out: TescilRecord[] = [];
    const day = new Date(from);
    day.setHours(0, 0, 0, 0);
    for (; day <= to; day.setDate(day.getDate() + 1)) {
      // Hafta içi günlerde girişler ~%6, çıkışlar ~%5 ihtimalle (işyeri yavaşça büyüyor)
      const n = (day.getDate() * 31 + day.getMonth() * 7 + seed + (kind === 'exit' ? 13 : 0)) % 100;
      if (day.getDay() === 0 || day.getDay() === 6 || n >= (kind === 'entry' ? 6 : 5)) continue;
      const i = n + day.getDate() + seed;
      out.push({
        // İşyerine özgü seed TC'ye doğrudan katılır; farklı işyerleri aynı kişiyi üretmez
        tckn: String(10000000000 + ((seed * 1_000_003 + i * 104729 + day.getTime() / 86_400_000) % 89999999999)).slice(0, 11),
        ad: firstNames[i % firstNames.length],
        soyad: lastNames[(i * 3) % lastNames.length],
        tarih: new Date(day),
        sigortaliTuru: '0',
        meslekKodu: ['9329.01', '5223.01', '4110.01', '7212.05'][i % 4],
        ...(kind === 'exit'
          ? { ayrilisNedeniKodu: exitCodes[i % exitCodes.length], ayrilisNedeni: EXIT_REASONS[exitCodes[i % exitCodes.length]] }
          : {}),
        referansNo: `${kind === 'entry' ? 'G' : 'C'}${day.getFullYear()}${String(i).padStart(8, '0')}`,
      });
    }
    return out;
  }

  async entries(c: TescilCredentials, from: Date, to: Date) {
    await this.verify(c);
    return this.generate(c, from, to, 'entry');
  }

  async exits(c: TescilCredentials, from: Date, to: Date) {
    await this.verify(c);
    return this.generate(c, from, to, 'exit');
  }
}
