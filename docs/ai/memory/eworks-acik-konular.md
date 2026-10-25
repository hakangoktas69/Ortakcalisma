---
name: eworks-acik-konular
description: Eworks açık konuları (2026-10-25) — 60/dk hız ile 500 ofis ölçeği, shard donanımı, bağlama atanmamış modüller, CODEOWNERS, Codex beceri desteği, canlı GİB doğrulaması, bağlamlar arası okuma birleşimleri, yönetim ekranları, ACL kapsam eşiği zorlanmıyor, TDD rehberindeki keşif kodu ifadesi onay bekliyor, web/BFF'te operasyon logu yok
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
9. **ACL kapsam eşiği zorlanmıyor (2026-10-25):** kurallarda "ACL ayrıştırıcıları %90" yazılı, ama `services/integration`'da pytest kapsam ölçümü (`pytest-cov`, `--cov-fail-under`) yok; TS tarafı (domain + application + kernel %90/%80) `pnpm verify` ve CI'da zorlanıyor. Eklemek imaj bağımlılığı ve CI adımı ister.
10. **Keşif kodu ifadesi onay bekliyor (2026-10-25):** `docs/gelistirici-rehberi/tdd.md` §5.3'teki "deneme kodu olduğu gibi birleştirilmez; öğrenilen davranış önce teste dönüşür" ifadesi yazılı bir kural değil, "testsiz kod yok" kuralından çıkarıldı. Ekip onaylarsa kurallara işlenir, onaylamazsa rehberden çıkarılır.
11. **Web/BFF'te operasyon logu yok (2026-10-26):** ACL JSON olay logu (`gunluk`), işçi `console.error` kullanıyor; `apps/web`'de ortak log yardımcısı yok. `api/gorevler` ve `api/notlar` uçları her hatayı (veritabanı kesintisi dahil) "Firma bulunamadı" 404'üne katlıyor ve loglamıyor; kesinti kullanıcıya yanlış mesajla, ekibe hiç görünmez. Kural `docs/ai/kurallar.md` "Hata ve log"da; tek log yardımcısı (kişisel veri süzgeçli) ve bu uçların düzeltilmesi bekliyor.

Süren iş: GİB/SGK web servis envanteri ve kurum erişim bilgileri Hakan tarafından analiz ediliyor (2026-10-24). Sonuç gelince 02 §1a'daki `integrations` tablosu ve 03 §1a hesapları güncellenir.

Kapananlar: D23–D30 (K-31…K-37) 2026-10-24; Mükellef Takip'in `eski/` sonrası durumu → **arşiv** (D32/K-39); depo taşıma tarihi ve ekip duyurusu → taşıma 2026-10-24'te yapıldı, duyuru önceden yapıldı ([[eworks-yeniden-yapilanma]]).

**Why:** Bu konular kapanmadan kapasite planı, bağlam sınırları ve sahiplik kesinleşemez; kullanıcı açık konuların hafızada durmasını istedi (2026-10-24).
**How to apply:** Eworks işine başlarken bu listeye bak. Konu kapanınca: `D-NN` + `K-NN` + ilgili `docs/hedef-mimari` belgesi + `docs/ai/durum.md` güncellenir, madde buradan silinir ([[eworks-calisma-bicimi]]). Kararların özeti: [[eworks-hedef-mimari]].
