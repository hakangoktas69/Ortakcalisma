# supabase — veritabanı

Kontrol düzlemi ve kiracı shard'ları ayrı migration dizinlerindedir ([07](../docs/hedef-mimari/07-veri-saklama-ve-sharding.md)).

- `migrations/control/` — kontrol düzlemi (ofis kaydı, shard eşlemesi, VKN tekilliği, satış hesapları).
- `migrations/tenant/` — her kiracı shard'ına aynen uygulanır. Ad bağlam önekli: `20261101_0001_portfolio__taxpayers.sql`.
- Her bağlamın kendi şeması vardır (`identity_access`, `portfolio`, `social_security`, …); RLS yardımcıları `app` şemasında. Kiracı tablolarında PK `(org_id, id)` ile başlar; RLS'siz tablo yoktur.
- `tests/<context>/*.sql` — pgTAP (RLS, kısıtlar, fonksiyonlar). `seed/` yalnız sentetik veri.
