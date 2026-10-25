# supabase — migration'lar ve veritabanı testleri

Yapı: [README.md](README.md). Repository tarafı: [DDD rehberi §3.4](../docs/gelistirici-rehberi/ddd.md#34-repository-depo), test tarafı: [TDD rehberi, pgTAP](../docs/gelistirici-rehberi/tdd.md#pgtap).

- Kontrol düzlemi `migrations/control/`, kiracı shard'ı `migrations/tenant/`. Ad bağlam önekli ve sıralı: `YYYYMMDD_NNNN_<şema>__<konu>.sql`; **idempotent** (`if not exists`, `create or replace`).
- **Uygulanmış migration değiştirilmez**; düzeltme yeni migration'dır.
- Her bağlam kendi şemasında; başka bağlamın tablosuna yazan/okuyan fonksiyon ya da görünüm yazılmaz. Yabancı anahtar yalnız kimlik sütunlarına.
- Her kiracı tablosu: `org_id`, PK `(org_id, id)` ile başlar, RLS açık ve politikası var. RLS yardımcıları `app` şemasında.
- `SECURITY DEFINER` fonksiyonda `set search_path = ''` ve tam nitelikli adlar. Kurum şifresi yalnız Vault'ta; sır sütunu web rolüne kapalı.
- Her yeni tablo/politika için önce kırmızı pgTAP testi (`tests/tenant/<şema>/*.sql`): RLS açık, başka ofis görmez, kapsam dışı görmez, yasak işlem `42501`. Koşucu: `node tools/deploy/yigin.mjs test`.
- `seed/` yalnız sentetik veri; gerçek kişi/mükellef yok.
