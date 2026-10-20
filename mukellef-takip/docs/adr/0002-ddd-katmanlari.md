# 0002 — DDD katmanları ve bağımlılık kuralları

- **Durum:** Kabul (2026-10-20)
- **Karar:** Her context `domain / application / infrastructure / interface` katmanlarına ayrılır. `domain` saf TypeScript'tir (Nest/Prisma yok). Context'ler arası import yalnız `index.ts`. Kurallar `apps/api/.dependency-cruiser.cjs` ile CI'da zorlanır.
- **Pragmatizm:** Basit CRUD'da application servisi Prisma'yı doğrudan kullanabilir; repository soyutlaması yalnız iş kuralı/test ihtiyacı olan aggregate'lerde. Mevcut saf kural dosyaları (`*-rules.ts`, parser'lar) taşınır, yeniden yazılmaz.
- **Sonuç:** Kurallar test edilebilir kalır, gereksiz soyutlama eklenmez.
