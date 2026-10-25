# 5.4 Dağıtım — Docker Compose veya Kubernetes (seçimli)

> Önce: [5.3 Kaynak verimliliği ve kapasite](03-kaynak-verimliligi-ve-kapasite.md)
> Karar D10: kurulum seçimlidir. Donanıma ve kullanıcı ölçeğine göre aynı imajlarla Compose veya Kubernetes kullanılır.
> **Not (25.10.2026, D35):** Bu belgede "MinIO" geçen yerler S3 uyumlu nesne deposunu anlatır. MinIO topluluk imajları yayından kalktığı için Compose'da **SeaweedFS** kullanılır; kod S3 portuna yazılır, depo değiştirilebilir.

## 1. İlke: tek imaj seti, iki dağıtım biçimi

- Her servis bir OCI imajıdır: `eworks-web`, `eworks-integration` (web servis işçisi, tarayıcısız), `eworks-robot` (yedek yol, Chromium), `eworks-ocr`, `eworks-parser`, `eworks-scheduler`, `eworks-outbox`. Supabase, RabbitMQ, Redis ve MinIO resmî imajlarla gelir. **Sürümler sabittir, `latest` kullanılmaz.**
- Yapılandırma **yalnız ortam değişkeni ve gizli dosya** (`*_FILE`) ile verilir. Değişken adları iki biçimde de aynıdır.
- Her servis şunları sağlar:
  - `GET /healthz` (canlılık) ve `GET /readyz` (hazırlık);
  - SIGTERM'de zarif kapanış: yeni iş alınmaz, mevcut adım bitirilir veya kuyruğa geri verilir;
  - JSON log (stdout) ve OpenTelemetry metrikleri.
- Kaynak sınırları her iki biçimde de **zorunludur** (Compose `deploy.resources.limits`, K8s `resources.requests/limits`).
- Dosya sistemi salt okunurdur, root olmayan kullanıcıyla çalışılır, yetenekler düşürülür.

## 2. Depo düzeni (öneri)

```
deploy/
  images/                    Dockerfile'lar (çok aşamalı, küçük taban imaj)
  compose/
    compose.yml              çekirdek: web, integration, robot, ocr, parser, scheduler, outbox
                             (robot + ocr ayrı profilde: `--profile robot`; servisi olan kurumlar için gerekmez)
    compose.supabase.yml     on-prem Supabase (sabit etiket)
    compose.infra.yml        rabbitmq, redis, minio, ters vekil
    compose.observability.yml  prometheus, grafana, loki, otel-collector
    profiles/
      small.env              tek sunucu
      medium.env             3–4 VM
    secrets/                 (gitignore) — örnek: README
  k8s/
    helm/eworks/             uygulama chart'ı
      values.yaml
      values-small.yaml
      values-large.yaml
    platform/                bağımlılıklar (seçimli)
      README.md              cert-manager, ingress-nginx, KEDA, RabbitMQ Cluster Operator,
                             CloudNativePG veya harici Postgres, external-secrets/OpenBao,
                             supabase-community helm chart
```

## 3. Biçim karşılaştırması

| Konu | Docker Compose | Kubernetes |
|---|---|---|
| Ne zaman | Küçük/orta: tek sunucu veya birkaç VM, ≤ ~30 ofis, küçük işletme ekibi | Büyük: çok ofis, otomatik ölçekleme, yüksek erişilebilirlik |
| Giriş | Caddy/Nginx konteyneri (TLS, WSS/SSE geçişi) | ingress-nginx + cert-manager |
| Ölçekleme | Elle: `docker compose up -d --scale robot=3 --scale parser=2` | HPA (web, CPU/istek), **KEDA** (robot ve parser, RabbitMQ kuyruk uzunluğu) |
| Robot üst sınırı | `.env`'de `ROBOT_REPLICAS` | KEDA `maxReplicaCount` = istek bütçesinden hesaplanan değer ([5.3 §1](03-kaynak-verimliligi-ve-kapasite.md#1-kapasite-hesabı--robot)); fazlası bütçeyi aşamayacağı için israftır |
| Postgres | Ayrı VM'de veya Compose'da kalıcı birimle; pgBackRest yan konteyner | **Öneri:** ayrı VM/fiziksel sunucu (her iki biçimde ortak) veya CloudNativePG operatörü |
| Supabase | Resmî `supabase/docker` compose, sabit etiket | supabase-community Helm chart veya Supabase servisleri ayrı chart'larla. Postgres harici |
| RabbitMQ | Tek düğüm (küçük) / 3 düğüm (orta) | RabbitMQ Cluster Operator, 3 düğüm quorum |
| Redis | Tek örnek (+ AOF) | Redis + Sentinel (Bitnami chart) |
| MinIO | Tek düğüm (küçük) / dağıtık (orta) | MinIO Operator |
| Gizli değerler | Docker secrets (dosya), `secrets/` gitignore | Kubernetes Secret + external-secrets → OpenBao |
| Zamanlanmış görev | `eworks-scheduler` sürekli servis (iç zamanlayıcı) | Aynı servis, `replicas: 1` + lider seçimi (iki biçimde aynı kod) |
| Güncelleme | `docker compose pull && up -d` (servis sırayla) | Kademeli dağıtım (rolling), PodDisruptionBudget |
| Gözlemlenebilirlik | `compose.observability.yml` | kube-prometheus-stack, Loki |

## 4. Sabit çıkış IP'si (her iki biçim, D14)

- Kurum trafiği **sabit, kayıtlı** 1 IP'den (yedekli: 2) çıkar. Bu IP kurumdan izin listesi istenirse bildirilecek adrestir.
- **Compose:** Robot konteynerleri, sabit IP'li ağ geçidi üzerinden NAT ile ya da tek bir çıkış vekili (ör. Squid) üzerinden çıkar (`EGRESS_PROXY=http://egress:3128`).
- **Kubernetes:** Robot podları, sabit IP'li çıkış ağ geçidine yönlenir (ör. Cilium Egress Gateway veya ayrılmış düğüm + SNAT).
- Her iki biçimde de robot ağının çıkışı yalnız kurum alan adlarına izinlidir (güvenlik duvarı / NetworkPolicy).

## 5. Ortam değişkenleri (ortak sözleşme, örnek)

| Değişken | Servis | Not |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY_FILE`, `SUPABASE_SERVICE_ROLE_KEY_FILE` | web | Yalnız sunucu. `NEXT_PUBLIC_*` yok |
| `DATABASE_URL_FILE` | robot, parser, scheduler, outbox | Rol başına ayrı kullanıcı |
| `REDIS_URL` | web, robot, scheduler | |
| `AMQP_URL_FILE` | robot, parser, outbox | |
| `S3_ENDPOINT`, `S3_ACCESS_KEY_FILE`, `S3_SECRET_KEY_FILE` | robot, parser, web | |
| `RATE_START_RPM`, `RATE_GLOBAL_RPM_MAX` | robot, scheduler | Varsayılanlar (60 / 120). Çalışırken DB'deki politika esastır |
| `DOCUMENT_RETENTION_DAYS` | scheduler | Varsayılan 7. Çalışırken DB'deki ayar esastır |
| `ROBOT_CONTEXTS_PER_WORKER` | robot | vars. 3 |
| `ROBOT_BROWSER_RECYCLE_JOBS` | robot | vars. 50 |
| `EGRESS_PROXY` | robot | Sabit çıkış vekili. Boşsa ağ geçidi NAT'ı |
| `OCR_URL` | robot | |
| `NIGHT_WINDOW` | scheduler | `20:00-09:00` |

## 6. Profil seçimi

| Profil | Biçim | Donanım | Uygun olduğu durum |
|---|---|---|---|
| Küçük | Compose, tek sunucu | 8 vCPU / 32 GB / 1 TB SSD | Pilot, ≤ 5 ofis |
| Orta | Compose, 3–4 VM (DB ayrı) | DB: 8 vCPU / 32 GB; uygulama: 2 × 8 vCPU / 16 GB; depolama VM'i | ≤ 30 ofis |
| Büyük | Kubernetes | 3+ uygulama düğümü, ayrı DB sunucuları, MinIO kümesi | 30+ ofis, otomatik ölçek, yüksek erişilebilirlik |

Geçiş yolu: Küçük → Orta değişikliği yalnız Compose dosyasının makinelere dağıtılmasıdır. Orta → Büyük geçişinde aynı imajlar ve değişkenler Helm `values`'a taşınır. Veri (Postgres, MinIO) yerinde kalır.

## 7. CI/CD

- Her commit'te şunlar çalışır:
  - testler (birim; sahte kurum sunucusuyla robot entegrasyonu; pgTAP RLS);
  - imaj derleme, Trivy taraması, SBOM;
  - `NEXT_PUBLIC_` kapısı.
- Etiketli sürümde imajlar kayda gönderilir. Compose için `profiles/*.env` + sürüm etiketi, K8s için chart sürümü yayımlanır.
- Migration ayrı bir iş olarak çalışır: Compose'da `migrate` tek seferlik servisi, K8s'te Helm `pre-upgrade` hook Job.
