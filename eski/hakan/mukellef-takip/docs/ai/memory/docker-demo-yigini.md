---
name: docker-demo-yigini
description: "Bütün Docker dosyaları infra/docker'da; demo yığını compose.demo.yml (yalnız Docker, :3000, RLS etkin), ayrı docker/ klasörü kaldırıldı"
metadata:
  node_type: memory
  type: project
  originSessionId: 7a33194b-d8c9-4eb2-b64f-9896e078c7bf
  modified: 2026-10-20T20:43:53.154Z
---

Projedeki tüm Dockerfile ve compose dosyaları `mukellef-takip/infra/docker/` altındadır; tek ignore dosyası kökteki `.dockerignore`. Dosya tablosu ve demo rehberi: `infra/docker/README.md` (bölüm "Demo").

- Demo: `docker compose -f infra/docker/compose.demo.yml up -d --build` (`npm run stack:demo`) → http://localhost:3000, giriş `demo@mukellef.test`. npm, yerel Node ve sır üretimi gerekmez. Dev/prod ile aynı Dockerfile'lar, Caddy, `migrate` servisi ve rol betiği; uygulama `mukellef_app` ile bağlanır, RLS etkin. Sırlar dosyada açık, sertleştirme yok → gerçek veriyle kullanılmaz.
- Proje adı `mukellef-takip-demo`: dev yığınıyla (`mukellef-takip`, :8080) aynı anda çalışabilir.
- 2026-10-20'de yeniden düzenlendi: hkazaz'dan gelen ayrı `docker/` klasörü (kendi Dockerfile'ları, süper kullanıcı bağlantısı, `next dev`) kaldırılıp `compose.demo.yml`'e taşındı. Ayrı Dockerfile'lar sürüm ve davranış olarak sapmış, Dockerfile'a özel `.dockerignore` kökteki ignore'u devre dışı bırakmıştı.

**Why:** Tek imaj tanımı sapmayı önler; demo gerçek yığınla aynı imajları derler.
**How to apply:** Yeni Dockerfile veya compose dosyasını `infra/docker/`'a koy, README tablosuna ekle; Dockerfile'a özel `*.dockerignore` oluşturma. "Sistemi çalıştır / demo göster" → `stack:demo`; geliştirme, güvenlik veya test kapısı → `stack:dev`. Yerel Node eskiyse demo yine çalışır: [[node-24-gerekli]]. Mimari bağlam: [[ddd-yeniden-yapilandirma]].
