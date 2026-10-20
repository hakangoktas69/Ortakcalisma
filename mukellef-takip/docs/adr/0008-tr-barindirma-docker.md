# 0008 — Türkiye'de barındırma, Docker Compose

- **Durum:** Kabul (2026-10-20)
- **Karar:** Tüm sistem Docker ile; TR veri merkezinde VM/on-prem. `infra/docker/compose.yml` + `compose.dev.yml` / `compose.prod.yml`. Yalnız Caddy dışa açık; iç ağlar `internal`. OpenBao (KMS), MinIO (şifreli yedek), Postgres, Redis container. İleride Kubernetes'e geçiş için imajlar 12-factor (config env/secrets, durumsuz api/worker).
- **Sonuç:** Yönetilen servis yok → yedek, güncelleme, izleme bizim sorumluluğumuzda (Faz 5 gözlemlenebilirlik).
