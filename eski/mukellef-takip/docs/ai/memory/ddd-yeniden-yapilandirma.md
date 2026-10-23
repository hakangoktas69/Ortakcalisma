---
name: ddd-yeniden-yapilandirma
description: "Mükellef Takip mimari yeniden yapılandırması — 2026-10-20 onaylandı; Faz 0-2 ve regresyon testleri bitti, Faz 3 (web BFF) ve Faz 4 (Expo mobil) bekliyor"
metadata:
  node_type: memory
  type: project
  originSessionId: 7a33194b-d8c9-4eb2-b64f-9896e078c7bf
  modified: 2026-10-20T17:15:04.838Z
---

2026-10-20'de onaylandı: modüler monolit, DDD (13 bounded context), Expo mobil, Türkiye'de on-prem barındırma ve OpenBao KMS. Faz 0-2 aynı gün uygulandı: Claude bağlamı ve ADR'ler, Docker yığını, Postgres RLS, outbox olayları, oturum ve yenileme anahtarları, kişisel veri kolon şifrelemesi, izolasyon e2e testleri, CI. Ardından regresyon testleri ve duyarlı arayüz eklendi (commit 55761fb).

**Why:** KVKK ile GİB/SGK yüksek güvenlik gerektiriyor; ekip büyüyebilmeli.
**How to apply:** Güncel durumun tek kaynağı [[roadmap]] (`docs/ai/roadmap.md`); işe başlamadan oraya bak ve biten adımı orada işaretle. Bu kayıt yalnız kararın bağlamını tutar. Ortam notu: [[node-24-gerekli]]. Docker yığınları (güvenlikli `infra/docker` ve sade demo): [[docker-demo-yigini]].
