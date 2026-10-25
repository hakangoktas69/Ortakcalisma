---
name: node-24-gerekli
description: "Prisma 7 ve araç zinciri Node 24 ister; yerel Node eskiyse (ör. 20.x) npm ve test komutları node:24 container'da çalıştırılır"
metadata:
  node_type: memory
  type: project
  originSessionId: 7a33194b-d8c9-4eb2-b64f-9896e078c7bf
  modified: 2026-10-20T17:15:02.994Z
---

Proje Node 24 ile çalışır (CI 24.22.0). Geliştirici makinelerinde daha eski Node olabiliyor; en az bir makinede 20.18 vardı ve Prisma 7 komutları orada çalışmadı.

**Why:** Eski Node'la `npx prisma …` ve testler yanıltıcı hatalar verir; zaman kaybettirir.
**How to apply:** Önce `node -v` ile sürüme bak. 24 değilse tam doğrulama için `npm run verify` kullan (izole Docker, Node 24). Tek komut için `docker run --rm -v "$PWD":/app -w /app node:24 npm …` çalıştır. Sistemi yalnız çalıştırıp görmek için yerel Node hiç gerekmez: [[docker-demo-yigini]]. Yalnız Node yerleşik modüllerini kullanan betikler (`tools/claude/*.mjs`, `infra/docker/scripts/*.mjs`) eski Node'da da çalışır.
