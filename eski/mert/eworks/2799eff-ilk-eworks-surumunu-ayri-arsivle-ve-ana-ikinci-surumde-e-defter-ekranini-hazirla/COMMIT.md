# Ilk Eworks surumunu ayri arsivle ve ana ikinci surumde e-Defter ekranini hazirla

> **Arşiv (D28, 26.10.2026).** Mert'in `dev` dalındaki commit'inin modül kodları, Hakan'ın isteğiyle commit adıyla açılan bu dizine aktarıldı. Burada geliştirme yapılmaz (kural 10); yeni yapıya alınan kısımlar testleriyle `services/integration` ve ilgili bağlamlara taşınır. Eworks 1/2 karşılaştırması: [../../../karsilastirma-fonksiyonel.md](../../../karsilastirma-fonksiyonel.md).

| Alan | Değer |
|---|---|
| Commit | `2799effbb71bfef56f9d40469a7ae57373b09a04` |
| Yazar | MERT-hb |
| Tarih | 2026-10-23T12:35:53+03:00 |
| Ebeveyn | `f1f7f5158970fca2bd2aa0f8fba7b466685dceee` |
| Dal | `dev` (birleştirme `bf27f08`) |

## Dizin düzeni

- Yollar commit'teki `mert/eworks/` önekine göredir; `mert/eworks/` dışındaki dosyalar `_mert/` altındadır.
- `CLAUDE.md` ve `AGENTS.md` → `CLAUDE.eski.md` / `AGENTS.eski.md`: Claude/Codex bu dizinde çalışırken onları etkin bağlam saymasın (D28'deki `docs/arsiv/mevcut-durum/*.eski.md` ile aynı neden).
- İçerik commit'teki hâliyle, bayt bayt aynıdır; silinen dosyalar aktarılmadı.
- [degisiklik.patch](degisiklik.patch): commit'in değişikliği (git yama biçimi).

## Aktarılan dosyalar (10)

| Durum | Commit'teki yol | Buradaki yol | Bayt |
|---|---|---|---|
| A | `mert/eworks-arsiv/.gitignore` | `_mert/eworks-arsiv/.gitignore` | 498 |
| A | `mert/eworks-arsiv/README.md` | `_mert/eworks-arsiv/README.md` | 666 |
| M | `mert/eworks/CLAUDE.md` | `CLAUDE.eski.md` | 1989 |
| M | `mert/eworks/README.md` | `README.md` | 1850 |
| M | `mert/eworks/docs/ai/memory/guncel-durum.md` | `docs/ai/memory/guncel-durum.md` | 3626 |
| M | `mert/eworks/docs/gunluk/2026-10-23.md` | `docs/gunluk/2026-10-23.md` | 3113 |
| M | `mert/eworks/entegrasyon-2-servis/Eworks-Portal/eworks-tasarim.html` | `entegrasyon-2-servis/Eworks-Portal/eworks-tasarim.html` | 260264 |
| M | `mert/eworks/entegrasyon-2-servis/README.md` | `entegrasyon-2-servis/README.md` | 3960 |
| M | `mert/eworks/entegrasyon-2-servis/SOURCE-MANIFEST.json` | `entegrasyon-2-servis/SOURCE-MANIFEST.json` | 36920 |
| M | `mert/eworks/entegrasyon-2-servis/VALIDATION.md` | `entegrasyon-2-servis/VALIDATION.md` | 3338 |

## İçerik değişmeden taşınanlar (285, aktarılmadı)

Bunlar Eworks 1'in (`entegrasyon-1-tarayici`) commit'te yalnız yeri değişen dosyalarıdır; içerikleri [../entegrasyon-1-tarayici/](../entegrasyon-1-tarayici/) altındakiyle aynıdır.

- `mert/eworks/entegrasyon-1-tarayici/Eworks-Portal/Baslat.ps1` → `mert/eworks-arsiv/entegrasyon-1-tarayici/Eworks-Portal/Baslat.ps1`
- `mert/eworks/entegrasyon-1-tarayici/Eworks-Portal/GIB-Canli-Akis.md` → `mert/eworks-arsiv/entegrasyon-1-tarayici/Eworks-Portal/GIB-Canli-Akis.md`
- `mert/eworks/entegrasyon-1-tarayici/Eworks-Portal/Kullanim.md` → `mert/eworks-arsiv/entegrasyon-1-tarayici/Eworks-Portal/Kullanim.md`
- `mert/eworks/entegrasyon-1-tarayici/Eworks-Portal/Supabase-GIB-Hesap-Kurulum.md` → `mert/eworks-arsiv/entegrasyon-1-tarayici/Eworks-Portal/Supabase-GIB-Hesap-Kurulum.md`
- `mert/eworks/entegrasyon-1-tarayici/Eworks-Portal/Supabase-Kullanim.md` → `mert/eworks-arsiv/entegrasyon-1-tarayici/Eworks-Portal/Supabase-Kullanim.md`
- … ve 280 dosya daha (`git show --stat -M 2799eff`)
