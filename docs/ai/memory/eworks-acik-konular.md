---
name: eworks-acik-konular
description: Eworks açık konuları (2026-10-25) — 60/dk hız ile 500 ofis ölçeği, shard donanımı, bağlama atanmamış modüller, CODEOWNERS, Codex beceri desteği, canlı GİB doğrulaması, bağlamlar arası okuma birleşimleri, yönetim ekranları
metadata:
  type: project
---

2026-10-25 itibarıyla Eworks hedef mimarisinde açık konular (aynı liste `docs/ai/durum.md`'de):

1. **Hız ve ölçek tutarlılığı:** 500 ofis × 1.505 ≈ 752.500 kurum hesabı var. Gece penceresi 20:00–09:00. Hepsini bir gecede taramak için web serviste ≈ 3.216 istek/dk gerekir. 60 istek/dk toplam başlangıç hızıyla tam tarama ≈ 54 gece sürer, robotla ≈ 536 gece (`docs/hedef-mimari/03-kaynak-verimliligi-ve-kapasite.md` §1a). Netleşmesi gerekenler:
   - "60 istek/dk ile başla" ve "hesap başına 60 istek/dk" ifadelerinin kapsamı (toplam mı, kurum mu, servis mi robot mu, hesap mı?);
   - web servis analizinden çıkacak kurum limitleri.
2. **Shard başlangıç donanımı:** Öneri: kontrol düzlemi + 2 fiziksel shard sunucusu, 16 mantıksal shard (`docs/hedef-mimari/07-veri-saklama-ve-sharding.md` §2.3).
3. **Bağlama atanmamış portal modülleri:** e-Tebligat, e-Defter, Faturalar, Dilekçeler, Ödeme, Raporlar, Destek `feature-registry`'de `context: null` (`docs/baglamlar/README.md`). Yeni bağlam mı, mevcut bağlam mı kararı bekliyor.
4. **CODEOWNERS:** bağlam başına sahipler (GitHub kullanıcı adları) belirlenmedi.
5. **Codex proje içi beceri desteği** doğrulanmadı; yedek yol `AGENTS.md` "Beceriler" bloğu (09 §7.5).
6. **Canlı GİB doğrulaması (2026-10-25):** eski portalın portu bitti; `firmalar.gib_sozlesmeler.sync`, `beyanname.senkron.start`, `sgk.ebildirge.sync` yalnız sahte GİB'e karşı sınandı. Canlı koşu Hakan'ın hesabıyla (`docs/gelistirici-rehberi/canli-dogrulama.md`); canlı güvenlik kodunda OCR başarısı bilinmiyor.
7. **Bağlamlar arası okuma birleşimleri:** tax-filing/social-security/workspace sorguları unvan için `portfolio.firms` ile birleşiyor (kural 5'ten sapma); okuma modeline taşınacak.
8. **Yönetim ekranları yok:** personel ataması, kişiye özel izin, davet, mükellef kullanıcıları; şimdilik `hesap-ac` komutu.

Süren iş: GİB/SGK web servis envanteri ve kurum erişim bilgileri Hakan tarafından analiz ediliyor (2026-10-24). Sonuç gelince 02 §1a'daki `integrations` tablosu ve 03 §1a hesapları güncellenir.

Kapananlar: D23–D30 (K-31…K-37) 2026-10-24; Mükellef Takip'in `eski/` sonrası durumu → **arşiv** (D32/K-39); depo taşıma tarihi ve ekip duyurusu → taşıma 2026-10-24'te yapıldı, duyuru önceden yapıldı ([[eworks-yeniden-yapilanma]]).

**Why:** Bu konular kapanmadan kapasite planı, bağlam sınırları ve sahiplik kesinleşemez; kullanıcı açık konuların hafızada durmasını istedi (2026-10-24).
**How to apply:** Eworks işine başlarken bu listeye bak. Konu kapanınca: `D-NN` + `K-NN` + ilgili `docs/hedef-mimari` belgesi + `docs/ai/durum.md` güncellenir, madde buradan silinir ([[eworks-calisma-bicimi]]). Kararların özeti: [[eworks-hedef-mimari]].
