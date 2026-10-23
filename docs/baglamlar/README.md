# Bağlam sayfaları

Her bounded context için: sorumluluk, ortak dil, aggregate ve kurallar, olaylar, BFF uçları, ekranlar, yetki anahtarları, test dosyaları, açık işler ([06 §5](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#5-depoyu-açan-resmi-görür-d21)). Kural, uç, olay veya sınır değişirse ilgili sayfa aynı değişiklikte güncellenir.

| Çekirdek | Destekleyici | Genel |
|---|---|---|
| [tax-filing](tax-filing.md) · [social-security](social-security.md) · [portfolio](portfolio.md) | [credentials](credentials.md) · [sync](sync.md) · [documents](documents.md) · [workspace](workspace.md) | [identity-access](identity-access.md) · [organization](organization.md) · [notifications](notifications.md) · [audit](audit.md) · [sales](sales.md) |

Python ACL (`services/integration`) bir bağlam değildir; alan modeli yoktur ([06 §1](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md) ilke 3).

## Henüz bağlama atanmamış modüller (açık konu)

Bugünkü portalda olup 06'daki bağlam haritasında karşılığı olmayan modüller `feature-registry`'de `context: null` ile kayıtlıdır: **e-Tebligat, e-Defter, Faturalar, Dilekçeler, Ödeme, Raporlar** (POS, araç, ticaret sicil, karşıt inceleme) ve **Destek**. Her biri için yeni bağlam mı, mevcut bağlama mı (ör. e-Tebligat → `documents`, e-Defter → `tax-filing`) kararı verildiğinde `D-NN`/`K-NN` olarak işlenir ve kayıttaki `context` doldurulur.
