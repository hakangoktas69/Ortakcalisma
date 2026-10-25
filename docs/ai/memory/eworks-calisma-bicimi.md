---
name: eworks-calisma-bicimi
description: Hakan'ın Eworks mimari çalışmasında beklediği iş biçimi — her karar D-NN + K-NN + durum + hafıza birlikte, açık konular hafızada, fiziksel/geri alınması zor işler yalnız onayla
metadata:
  type: feedback
---

Hakan, Eworks hedef mimarisi oturumlarında (2026-10-23/24) şu iş biçimini istedi ve onayladı:

- Her yeni karar **aynı değişiklikte** dört yere işlenir:
  - `docs/hedef-mimari/01-cok-kiracili-hedef-mimari.md` karar tablosu (`D-NN`, sırayla);
  - karar kaydı `docs/adr/karar-kaydi.md` (`K-NN`);
  - `docs/ai/durum.md`;
  - ekip hafızası ([[eworks-hedef-mimari]]).

  İlgili ayrıntı belgesi ve bağlam sayfası da güncellenir. (Kural olarak `docs/ai/kurallar.md`'de de yazılı.)
- **Açık konular hafızada durur** ([[eworks-acik-konular]]) ve `docs/ai/durum.md`'de. Kapanan madde silinir ve kararı işlenir.
- Kullanıcı yanıtlarını madde madde verir. Her maddenin yanıtı ayrı bir karara dönüştürülür. Yanıtın kapsamı belirsizse (ör. "60/dk" toplam mı, hesap başına mı) varsayım yapılmaz; açık konuya yazılır ve sorulur.
- Klasör taşıma veya başkasının klasörüne yazma gibi fiziksel ve geri alınması zor işlerde önce kapsam sorulur, plan gösterilip onay beklenir. İstemde doldurulmamış seçenek (yer tutucu) varsa varsayılmaz, sorulur (2026-10-24 yeniden yapılanma istemi).
- Belgeler Türkçe yazılır, mermaid diyagramları çizilerek (mermaid-cli) doğrulanır, göreli bağlantılar denetlenir (`node tools/docs/baglanti-denetle.mjs`), hafıza değişikliğinden sonra `check-memory` koşulur. Commit istenmedikçe yapılmaz; push ayrıca istenir.
- Kurumun erişim denetimini atlatmaya yönelik istekler (ör. hesap başına IP rotasyonu/spoofing) tasarıma alınmaz. Gerekçe (K-22) yazılır ve meşru alternatif önerilir.

**Why:** Kararlar çok sayıda ve birbirine bağlı (D1–D35). Tek bir yerde unutulan güncelleme belgeler ile hafıza arasında çelişki üretti (ör. 30 → 60 istek/dk değişikliğinin bir hafıza satırında eski kalması, 2026-10-24'te düzeltildi).
**How to apply:** Eworks mimari işinde her yanıttan sonra dört yeri birlikte güncelle, sonra tutarlılık taraması yap: eski değerleri `grep`'le ara, bağlantıları ve mermaid'i denetle, `check-memory` ve `senkron --denetle` koş. Yeniden yapılanma notları: [[eworks-yeniden-yapilanma]].
