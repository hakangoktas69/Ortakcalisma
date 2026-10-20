# 0 · Genel bakış

> Seviye 0 — Sistem ne yapar, kim kullanır, hangi parçalardan oluşur. Ayrıntı için alt seviyelere bağlantılar var.

## Bir cümlede

Mükellef Takip, mali müşavir bürolarının onlarca–yüzlerce mükellefi için **beyanname, e-Defter, e-Tebligat, SGK, fatura ve bordro yükümlülüklerini tek bir iş kutusunda** izlediği, çok kiracılı (büro başına izole) bir web uygulamasıdır.

## Kim kullanır

| Aktör | Ne yapar |
|---|---|
| **Büro yöneticisi** (ADMIN) | Kullanıcı, güvenlik politikası (2FA), lisans/ödeme, toplu aktarım, asistan onayı |
| **Büro personeli** (STAFF) | Günlük iş: iş kutusu, beyanname kontrolü, tebligat inceleme, SGK rapor onayı, dilekçe |
| **Chrome eklentisi** | Kullanıcının açtığı GİB/SGK sayfasındaki tabloyu (kullanıcı onayıyla) sisteme aktarır |
| **Zamanlanmış işler** (worker) | Gece SGK senkronu, sabah hatırlatıcıları, bildirim gönderimi, olay dağıtımı |

## Sistem bağlamı (C4 — seviye 1)

```mermaid
flowchart TB
  subgraph kullanici["Kullanıcı tarafı"]
    direction LR
    U["Büro kullanıcısı<br/>tarayıcı / telefon"]
    EXT["Chrome eklentisi<br/>kullanıcının tarayıcısında"]
  end

  MT["<b>Mükellef Takip</b><br/>çok kiracılı web uygulaması<br/>Türkiye'de barındırılır"]

  subgraph kamu["Kamu sistemleri"]
    direction LR
    GIB["GİB / SGK<br/>web siteleri"]
    SGK["SGK Vizite / 4A<br/>web servisleri"]
  end

  subgraph dis["Dış servisler"]
    direction LR
    IYZ["iyzico<br/>ödeme"]
    WA["Meta WhatsApp<br/>bildirim"]
    CL["Claude API<br/>asistan"]
  end

  U -->|"1"| MT
  EXT -->|"2"| MT
  U -.->|"3"| GIB
  EXT -.->|"4"| GIB
  MT -->|"5"| SGK
  MT -->|"6"| IYZ
  MT -->|"7"| WA
  MT -->|"8"| CL

  classDef sistem fill:#1f6feb,stroke:#0b3d91,color:#ffffff,stroke-width:2px
  classDef dissistem fill:#f6f8fa,stroke:#8c959f,color:#1f2328
  class MT sistem
  class GIB,SGK,IYZ,WA,CL dissistem
```

| # | Akış | Kural |
|---|---|---|
| 1 | Kullanıcı → sistem: HTTPS | Oturum, 2FA, büro izolasyonu |
| 2 | Eklenti → sistem: sayfadan okunan tablo | Eklenti anahtarıyla; önizleme → onay |
| 3 | Kullanıcı GİB/SGK sayfasını **kendisi** açar | Sistem GİB'e bağlanmaz, şifre saklamaz |
| 4 | Eklenti açık sayfadaki tabloyu okur | Yalnız kullanıcı onayıyla |
| 5 | Sistem → SGK: SOAP | Kurum şifresi KMS ile şifreli, her çözme denetim kaydında |
| 6 | Sistem → iyzico: ödeme formu, sorgu | Tutar sunucuda hesaplanır |
| 7 | Sistem → WhatsApp: şablon mesaj | Kişisel veri taşımaz |
| 8 | Sistem → Claude API: soru | Maskeli; büro onayı olmadan gitmez |

Sınır kuralları: **GİB'e sistem kendisi bağlanmaz** (şifre saklamaz, robot yok); veri kullanıcının açtığı sayfadan gelir. Yurt dışına çıkan iki kanal (WhatsApp, Claude) kişisel veri taşımaz / büro onayı ister. Gerekçe: [Güvenlik mimarisi](04-mimari/03-guvenlik-mimarisi.md).

## Kapsayıcılar (C4 — seviye 2)

```mermaid
flowchart TB
  NET(["İnternet<br/>tarayıcı · eklenti"])

  subgraph edge["edge ağı · dışa açık"]
    C["Caddy<br/>TLS · HSTS · :443"]
    W["web<br/>Next.js"]
  end

  A["api<br/>NestJS HTTP"]
  WK["worker<br/>kuyruk · zamanlayıcı · outbox"]

  subgraph app["app ağı · internal"]
    R[("Redis<br/>kuyruk · hız sınırı")]
    B["OpenBao<br/>anahtar yönetimi · prod"]
  end

  subgraph data["data ağı · internal"]
    P[("PostgreSQL 17<br/>RLS")]
    M["migrate<br/>tek seferlik"]
    BK["backup<br/>şifreli dump · prod"]
  end

  NET --> C
  C -->|"/"| W
  C -->|"/api"| A
  C ~~~ WK
  A --> R
  A --> B
  WK --> R
  WK --> B
  A --> P
  WK --> P
  M --> P
  BK --> P

  classDef surec fill:#1f6feb,stroke:#0b3d91,color:#ffffff
  class A,WK surec
```

- Dışarıya yalnız Caddy açıktır. `app` ve `data` ağları `internal` olduğu için dışarı çıkamaz. Ağlar arasında köprü kuran süreçler yalnız **api** (edge + app + data) ve **worker**'dır (app + data). Kaynak: `infra/docker/compose*.yml`.
- **api** ve **worker** aynı kod tabanı ve aynı imajdır; farklı giriş noktasıyla çalışır (`src/main.ts`, `src/worker.ts`). Ayrıntı: [Çalışma zamanı](04-mimari/01-calisma-zamani.md).
- Tek veritabanı, tek şema; büro izolasyonu satır düzeyinde (RLS). Ayrıntı: [Veri modeli](04-mimari/02-veri-modeli.md).

## Kod tabanı içinde (C4 — seviye 3, özet)

```
apps/api/src/
  modules/<13 bounded context>/   domain · application · infrastructure · interface/http · index.ts
  platform/                       config · database (RLS) · crypto (KMS) · audit · events (outbox) · logging · security · http
  shared-kernel/                  TCKN, para, tablo metni, PII maskeleme — saf yardımcılar
apps/web/src/                     Next.js App Router: app/ (sayfalar), components/ (görünümler), lib/api.ts
apps/extension/                   Chrome MV3 eklentisi
infra/docker/                     compose (dev/prod/test), Dockerfile'lar, Caddy, OpenBao, yedek
```

13 bounded context: `identity`, `taxpayers`, `tax-filing`, `tebligat`, `social-security`, `invoicing`, `payroll`, `billing`, `documents`, `assistant`, `notifications`, `workspace`, `data-intake`. Neden bu bölünme: [Bağlam haritası](01-stratejik-tasarim/03-baglam-haritasi.md); her birinin ayrıntısı: [Katalog](02-baglamlar/README.md).

## Bir isteğin yolculuğu (örnek: "Tebligatı incelendi işaretle")

```mermaid
sequenceDiagram
  participant T as Tarayıcı
  participant C as Caddy
  participant M as Middleware (runWithDbContext)
  participant G as AuthGuard (identity)
  participant Ctl as TebligatController
  participant S as TebligatService
  participant DB as PostgreSQL (RLS)
  T->>C: PUT /api/tebligat/:id/review (Bearer)
  C->>M: X-Forwarded-For, X-Request-Id
  M->>G: istek bağlamı açılır (büro henüz yok)
  G->>DB: oturum doğrulama (sistem bağlamı)
  G-->>M: setCurrentTenant(büro)
  M->>Ctl: DTO doğrulama (whitelist)
  Ctl->>S: setReviewed(tenantId, userId, id, true)
  S->>DB: UPDATE … WHERE id AND company.tenantId (app.tenant_id = büro)
  DB-->>S: yalnız bu büronun satırı görünür
  S-->>T: { ok: true }
```

Her adımın ayrıntısı: [Çapraz kesen konular](03-taktiksel-tasarim/05-capraz-kesen-konular.md).

## Temel kalite hedefleri (öncelik sırasıyla)

1. **Gizlilik ve izolasyon** — bir büro diğerinin verisini hiçbir koşulda göremez; kişisel veri şifreli, maskeli, denetimli.
2. **Doğruluk** — son günler, tebliğ tarihleri, mutabakat kuralları test edilmiş saf fonksiyonlardır.
3. **Kullanıcı kontrolü** — kuruma yazan her işlem açık kullanıcı eylemidir; toplu aktarım önce önizleme gösterir.
4. **Değiştirilebilirlik** — bağlam sınırları kodla zorlanır; bir bağlamı değiştirmek diğerlerini kırmaz.
5. **İşletilebilirlik** — tek komutla Docker yığını, test kapıları, şifreli yedek.

Sonraki seviye: [1 · Stratejik tasarım](01-stratejik-tasarim/01-is-alani-ve-alt-alanlar.md).
