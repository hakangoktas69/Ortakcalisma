---
name: eworks-calisma-bicimi
description: "[mert/eworks] Hakan'ın Eworks mimari çalışmasında beklediği iş biçimi: her karar D-NN + K-NN + durum + hafıza birlikte, açık konular hafızada, fiziksel taşıma yalnız onayla"
metadata:
  type: feedback
---

Klasör: mert/eworks

Hakan, Eworks hedef mimarisi oturumlarında (2026-10-23/24) şu iş biçimini istedi ve onayladı:

- Her yeni karar **aynı değişiklikte** dört yere işlenir:
  - `05-hedef-mimari/01-cok-kiracili-hedef-mimari.md` karar tablosu (`D-NN`, sırayla);
  - karar kaydı `02-mimari/05-mimari-kararlar.md` (`K-NN`);
  - `ai/durum-ve-riskler.md`;
  - ekip hafızası ([[eworks-hedef-mimari]]).

  İlgili ayrıntı belgesi de güncellenir.
- **Açık konular hafızada durur** ([[eworks-acik-konular]]). Kapanan madde silinir ve kararı işlenir.
- Kullanıcı yanıtlarını madde madde verir. Her maddenin yanıtı ayrı bir karara dönüştürülür. Yanıtın kapsamı belirsizse (ör. "60/dk" toplam mı, hesap başına mı) varsayım yapılmaz; açık konuya yazılır ve sorulur.
- Klasör taşıma veya başkasının klasörüne yazma gibi fiziksel ve geri alınması zor işlerde önce kapsam sorulur. Kullanıcı "şimdilik yalnız belgele" dediyse yalnız belge ve hafıza güncellenir.
- Belgeler Türkçe yazılır, mermaid diyagramları çizilerek (mermaid-cli) doğrulanır, göreli bağlantılar denetlenir, hafıza değişikliğinden sonra `check-memory` koşulur. Commit, istenmedikçe yapılmaz.
- Kurumun erişim denetimini atlatmaya yönelik istekler (ör. hesap başına IP rotasyonu/spoofing) tasarıma alınmaz. Gerekçe (K-22) yazılır ve meşru alternatif önerilir.

**Why:** Kararlar çok sayıda ve birbirine bağlı (D1–D31). Tek bir yerde unutulan güncelleme belgeler ile hafıza arasında çelişki üretti (ör. 30 → 60 istek/dk değişikliğinin bir hafıza satırında eski kalması, 2026-10-24'te düzeltildi).
**How to apply:** Eworks mimari işinde her yanıttan sonra dört yeri birlikte güncelle, sonra tutarlılık taraması yap: eski değerleri `grep`'le ara, bağlantıları ve mermaid'i denetle, `check-memory` koş. Yeniden yapılanma uygulaması: [[eworks-yeniden-yapilanma]].
