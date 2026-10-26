# Eworks beyanname ve bildirge tablolarinda Detay dugmesini ekrana sigdir

> **Arşiv (D28, 26.10.2026).** Mert'in `dev` dalındaki commit'inin modül kodları, Hakan'ın isteğiyle commit adıyla açılan bu dizine aktarıldı. Burada geliştirme yapılmaz (kural 10); yeni yapıya alınan kısımlar testleriyle `services/integration` ve ilgili bağlamlara taşınır. Eworks 1/2 karşılaştırması: [../../../karsilastirma-fonksiyonel.md](../../../karsilastirma-fonksiyonel.md).

| Alan | Değer |
|---|---|
| Commit | `7b48e1f670ab8cc7acda157082a406b63261eedb` |
| Yazar | MERT-hb |
| Tarih | 2026-10-23T12:05:16+03:00 |
| Ebeveyn | `80220cff8a469337cdb71c1e3798b3c56cd61694` |
| Dal | `dev` (birleştirme `bf27f08`) |

## Dizin düzeni

- Yollar commit'teki `mert/eworks/` önekine göredir; `mert/eworks/` dışındaki dosyalar `_mert/` altındadır.
- `CLAUDE.md` ve `AGENTS.md` → `CLAUDE.eski.md` / `AGENTS.eski.md`: Claude/Codex bu dizinde çalışırken onları etkin bağlam saymasın (D28'deki `docs/arsiv/mevcut-durum/*.eski.md` ile aynı neden).
- İçerik commit'teki hâliyle, bayt bayt aynıdır; silinen dosyalar aktarılmadı.
- [degisiklik.patch](degisiklik.patch): commit'in değişikliği (git yama biçimi).

## Aktarılan dosyalar (4)

| Durum | Commit'teki yol | Buradaki yol | Bayt |
|---|---|---|---|
| M | `mert/eworks/docs/gunluk/2026-10-23.md` | `docs/gunluk/2026-10-23.md` | 2594 |
| M | `mert/eworks/entegrasyon-2-servis/Eworks-Portal/eworks-tasarim.html` | `entegrasyon-2-servis/Eworks-Portal/eworks-tasarim.html` | 250588 |
| M | `mert/eworks/entegrasyon-2-servis/SOURCE-MANIFEST.json` | `entegrasyon-2-servis/SOURCE-MANIFEST.json` | 36920 |
| M | `mert/eworks/entegrasyon-2-servis/VALIDATION.md` | `entegrasyon-2-servis/VALIDATION.md` | 2848 |
