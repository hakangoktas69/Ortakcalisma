<!-- senkron:uretildi — elle düzenlemeyin; kaynak ve üretici: node tools/ajan/senkron.mjs --yaz -->
# supabase — migration'lar ve veritabanı testleri — kodlama ajanı talimatları

Bu dizinde çalışırken önce bu dizindeki `CLAUDE.md`'yi oku; kurallar oradadır ve senin için de bağlayıcıdır. Kök talimatlar: [../AGENTS.md](../AGENTS.md).

`CLAUDE.md` içeriği:

- Kontrol düzlemi `migrations/control/`, kiracı shard'ı `migrations/tenant/`. Ad bağlam önekli ve sıralı: `YYYYMMDD_NNNN_<şema>__<konu>.sql`; **idempotent** (`if not exists`, `create or replace`).
- **Uygulanmış migration değiştirilmez**; düzeltme yeni migration'dır.
- Her bağlam kendi şemasında; başka bağlamın tablosuna yazan/okuyan fonksiyon ya da görünüm yazılmaz. Yabancı anahtar yalnız kimlik sütunlarına.
- Her kiracı tablosu: `org_id`, PK `(org_id, id)` ile başlar, RLS açık ve politikası var. RLS yardımcıları `app` şemasında.
- `SECURITY DEFINER` fonksiyonda `set search_path = ''` ve tam nitelikli adlar. Kurum şifresi yalnız Vault'ta; sır sütunu web rolüne kapalı.
- Her yeni tablo/politika için önce kırmızı pgTAP testi (`tests/tenant/<şema>/*.sql`): RLS açık, başka ofis görmez, kapsam dışı görmez, yasak işlem `42501`. Koşucu: `node tools/deploy/yigin.mjs test`.
- `seed/` yalnız sentetik veri; gerçek kişi/mükellef yok.
