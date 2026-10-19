import { Injectable } from '@nestjs/common';
import type { DeclarationType } from '../../generated/prisma/enums.js';
import { expectedForMonth } from '../declaration-rules.js';

// GİB'den verilmiş beyannameleri getiren kaynak.
//
// GİB e-Beyanname için herkese açık resmi bir sorgu servisi yoktur. Canlı kaynağın nasıl
// kurulacağı (kullanıcının kendi oturumu / açık onaylı şifreli otomasyon) henüz kararlaştırılmadı;
// karar verilene kadar canlı modda açık bir hata döner, tahmini isteklerle GİB'e gidilmez.

export interface GibFiledDeclaration {
  taxNumber: string;
  type: DeclarationType;
  period: string;
  filedAt: Date;
  accrualAmount?: number;
  referenceNo?: string;
}

export interface GibDeclarationSource {
  readonly mode: 'mock' | 'live';
  /** Verilen VKN/TCKN'ler için, kontrol ayına ait verilmiş beyannameler. */
  filed(taxNumbers: string[], year: number, month: number): Promise<GibFiledDeclaration[]>;
}

export const GIB_SOURCE = Symbol('GIB_SOURCE');

export class GibSourceError extends Error {}

@Injectable()
export class LiveGibSource implements GibDeclarationSource {
  readonly mode = 'live' as const;
  filed(): Promise<never> {
    return Promise.reject(
      new GibSourceError('Canlı GİB e-Beyanname bağlantısı henüz kurulmadı; veri kaynağı kararı bekleniyor.'),
    );
  }
}

/**
 * Demo kaynak: GİB'e bağlanmaz. VKN + tür + döneme göre deterministik sonuç üretir;
 * son günü geçmiş beyannamelerin çoğu verilmiş, son günü yaklaşanların bir kısmı verilmiş görünür.
 * Not: Hangi beyannamelerin "beklendiğini" bilmez; firmanın yükümlülüğü olmayan türler de
 * dönebilir, kontrol motoru zaten sadece yükümlü olunanlara bakar.
 */
@Injectable()
export class MockGibSource implements GibDeclarationSource {
  readonly mode = 'mock' as const;

  async filed(taxNumbers: string[], year: number, month: number) {
    const now = new Date();
    const out: GibFiledDeclaration[] = [];
    for (const vkn of taxNumbers) {
      for (const e of expectedForMonth(year, month)) {
        let h = 2166136261;
        for (const ch of `${vkn}|${e.type}|${e.period}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
        const roll = h % 100;
        const daysLeft = (e.dueDate.getTime() - now.getTime()) / 86_400_000;
        // Son günü geçmişse %92, son 5 gün içindeyse %55, daha uzaksa %25 ihtimalle verilmiş
        const p = daysLeft < 0 ? 92 : daysLeft < 5 ? 55 : 25;
        if (roll >= p) continue;
        // Verilme tarihi: son günden 0–9 gün önce; ama bugünden ileri olamaz.
        // Son günü geçmiş olanların %4'ü geç verilmiş olsun.
        const filedAt = new Date(e.dueDate.getTime() - ((h >>> 8) % 10) * 86_400_000);
        if (daysLeft < 0 && roll < 4) filedAt.setTime(e.dueDate.getTime() + 2 * 86_400_000);
        if (filedAt > now) filedAt.setTime(now.getTime() - ((h >>> 12) % 3) * 86_400_000);
        out.push({
          taxNumber: vkn,
          type: e.type,
          period: e.period,
          filedAt,
          accrualAmount: e.type === 'DAMGA' ? (h % 900) + 50 : (h % 90_000) + 1000,
          referenceNo: `DEMO${year}${String(h % 10 ** 9).padStart(9, '0')}`,
        });
      }
    }
    return out;
  }
}
