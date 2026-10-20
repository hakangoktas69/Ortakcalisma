# Güvenlik, KVKK ve GİB/SGK kuralları

> Bu belge hukuki görüş değildir; KVKK aydınlatma metni, VERBİS kaydı ve imha politikası bir hukukçuyla hazırlanmalıdır. Burada yazılımın uyması gereken teknik kurallar vardır.

## Veri sınıflandırması

| Sınıf | Örnek | Kural |
|---|---|---|
| **S0 — Sır** | Kurum şifreleri (SGK Vizite, 4A sistem/işyeri şifresi), TOTP gizli anahtarı, iyzico/WhatsApp/Claude anahtarları, JWT/KMS anahtarları | KMS ile şifreli; asla yanıt/log'da yok; her çözme denetim kaydı; prod'da Docker secrets / OpenBao |
| **S1 — Özel nitelikli kişisel veri** (KVKK md.6) | SGK e-rapor: vaka türü (hastalık, iş kazası, analık), tanı/poliklinik, rapor tarihleri + kişi | Kolon şifreleme; erişim denetim kaydı; minimum saklama; LLM/push/log'a asla |
| **S2 — Kişisel veri** | TCKN, ad soyad (çalışan), telefon, e-posta, bordro tutarları, IBAN | TCKN şifreli + blind index; ekranda maskeli; log redaksiyonu |
| **S3 — Ticari gizli** | Mükellef VKN, unvan, beyanname tahakkuku, fatura tutarları | Tenant izolasyonu; dışa aktarma denetim kaydı |
| **S4 — Genel** | Vergi takvimi, sistem dilekçe şablonları | — |

## Teknik kontroller

### Kimlik ve oturum
- Parola: en az 10 karakter, harf+rakam; **argon2id**; 5 hatalı denemede 15 dk kilit (DB'de); kayıtsız e-postada sabit maliyet.
- 2FA (TOTP) + 10 kurtarma kodu (hash'li); büro politikasıyla zorunlu tutulabilir. Hedef: prod'da yönetici hesapları için zorunlu.
- Oturum: her istekte `isActive` + `sessionVersion` + rol DB'den. Hedef: 15 dk access + dönen refresh token, yeniden kullanım tespitinde tüm aile iptal; web'de HttpOnly çerez (JS'e token yok).
- Eklenti anahtarı: kapsam `gib:import`, SHA-256 hash, süreli (vars. 90 gün), sahibi devre dışıysa / 2FA yoksa çalışmaz.

### Yetkilendirme ve izolasyon
- Her uç `AuthGuard` arkasında (istisnalar: login, iyzico callback — sunucu iyzico'ya sorarak doğrular).
- Tenant: uygulama filtresi + **RLS**. Yeni tablo eklerken: `tenantId` + politika + e2e izolasyon testi.
- Yönetici işlemleri `AdminGuard`. Asistan sohbetlerini yalnız sahibi görür.

### Şifreleme
- Aktarımda: TLS 1.2+ (Caddy), HSTS; iç ağda Postgres TLS (prod).
- Durağanda: kurum şifreleri ve S1/S2 kolonları uygulama düzeyinde AES-256-GCM (`v1:` yerel anahtar, `v2:` OpenBao Transit ile tenant DEK); disk/volume şifrelemesi ve **şifreli yedek** ayrıca.
- Anahtar rotasyonu: önek sürümüyle okunur, worker işi yeni sürümle yeniden şifreler.

### Denetim kaydı (`AuditLog`)
- Yazılanlar: giriş/çıkış, şifre/2FA/rol değişikliği, kurum şifresi kaydetme/çözme, SGK'ya yazma, toplu aktarım, rapor dışa aktarma, ödeme, **S1/S2 okuma** (rapor listesi, bordro detayı).
- Değiştirilemez: uygulama rolünde UPDATE/DELETE yok; her satır öncekinin özetini içerir (hash zinciri).
- İçerik: kişisel verinin kendisi değil, kimliği/türü (ör. `{ reportId }`, soru metni yazılmaz).

### Uygulama güvenliği
- Girdi: `ValidationPipe` whitelist; dosya boyut/tür sınırı; zip bombası ve XXE koruması; CSV formül enjeksiyonu koruması.
- Başlıklar: helmet (API), nonce'lu CSP + `frame-ancestors 'none'` (web), HSTS (Caddy).
- Hız sınırı: `/auth/*` sıkı, `/assistant/ask`, `/import/*`, dosya yüklemeleri ayrı limit.
- CORS: yalnız `WEB_ORIGIN` ve eklenti kimliği (prod'da eklenti ID'si sabitlenir).
- Hata yanıtları iç detay/stack içermez.

### Altyapı
- Yalnız Caddy dışarı açık. Postgres/Redis/OpenBao iç ağda (`internal: true`).
- Container: non-root, read-only rootfs, `cap_drop: ALL`, `no-new-privileges`, sabit imaj sürümü, Trivy taraması.
- Postgres: `app_user` (RLS'e tabi, sahip değil), `migrator` (yalnız migrate container'ı).
- Sırlar: Docker secrets (`*_FILE`), repo'da yalnız `.env.example` (boş/yer tutucu).
- Yedek: günlük şifreli tam + WAL; geri yükleme her ay denenir.

## KVKK gereklilikleri (yazılım tarafı)

| Madde | Uygulama |
|---|---|
| Veri minimizasyonu (md.4) | Fatura satır detayı saklanmaz; `raw` JSON kolonları PII'dan arındırılır veya şifrelenir; bordro kümülatif/istisna sütunları okunmaz |
| Özel nitelikli veri (md.6) | e-rapor alanları şifreli, erişim loglu, ekranda yalnız gerekli alan |
| Saklama ve imha (md.7) | Context başına saklama süresi (`docs/ai/roadmap.md` → imha işi); süre dolunca worker anonimleştirir/siler ve kaydeder |
| Yurt dışı aktarım (md.9) | Barındırma TR. Claude asistanı: varsayılan kapalı, `Tenant.assistantConsentAt` olmadan çalışmaz, yalnız redakte edilmiş soru gider. WhatsApp (Meta) bildirimi: kullanıcının açık rızası tarihli saklanır, mesajda kişisel veri yok |
| Veri güvenliği (md.12) | Bu belgedeki teknik kontroller; ihlal bildirimi için olay müdahale prosedürü (72 saat) |
| İlgili kişi hakları (md.11) | Hedef: çalışan bazında veri dışa aktarma ve silme talebi aracı (yönetici) |

## GİB / SGK'ya özgü kurallar

- **GİB:** Otomatik giriş, şifre saklama, CAPTCHA aşma yok. Veri yalnız kullanıcının açtığı sayfadan eklentiyle, önizleme → onayla.
- **SGK Vizite/4A:** Web servis şifreleri kasada; senkron yalnız okur (+ okunan raporu kapatır, kayıt başarılı olduktan sonra). Çalışmazlık onayı yalnız kullanıcı eylemiyle. Canlı mod pilot işyerinde doğrulanmadan genel açılmaz.
- **iyzico:** Kart verisi sunucuya gelmez; callback'te tarayıcıya güvenilmez, sunucu iyzico'ya sorar ve tutarı/para birimini/fraud durumunu doğrular.

## Tehdit modeli özeti (öncelikli)

1. Büro A'nın büro B verisini görmesi → uygulama filtresi + RLS + e2e test.
2. XSS ile oturum çalınması → HttpOnly çerez, CSP.
3. Veritabanı dökümünün sızması → kolon şifreleme + KMS anahtarı DB dışında + şifreli yedek.
4. Kurum şifresinin kötüye kullanımı → KMS, denetim kaydı, en az yetki (yalnız okuma senkronu).
5. Kimlik bilgisi doldurma → argon2id, kilit, hız sınırı, 2FA.
6. Tedarik zinciri → kilitli bağımlılıklar, `npm audit`, Trivy, gitleaks.
7. İçeriden tehdit (büro personeli) → rol, denetim kaydı, dışa aktarma kaydı.

## Uygulanmış kontroller (2026-10-20) — nerede

| Kontrol | Kod / yapılandırma |
|---|---|
| Config doğrulama, üretimde güvensiz ayar reddi | `apps/api/src/platform/config/config.ts` |
| RLS + uygulama rolü | migration `20261020110000_rls_ve_roller`, `platform/database/rls-pool.ts`, `infra/docker/postgres/init/01-roles.sh` |
| Kolon şifreleme + blind index | `platform/crypto/vault.service.ts`, `personal-data.ts`, `personal-data.backfill.ts` |
| KMS (OpenBao Transit) | `platform/crypto/kms.ts`, `infra/docker/openbao/` |
| Denetim kaydı hash zinciri | `platform/audit/` |
| Oturum / yenileme anahtarı | `modules/identity/application/session.service.ts` |
| Hız sınırı, güvenlik başlıkları | `platform/security/`, `platform/http/configure-app.ts`, `infra/docker/caddy/Caddyfile`, `apps/web/next.config.ts` |
| Log redaksiyonu | `platform/logging/logging.module.ts`, `shared-kernel/pii-redact.ts` |
| Dış kanalda kişisel veri yok | `modules/notifications/application/event-handlers.ts` (`externalBody`), `notifications.service.ts` (`deliver`) |
| Yurt dışı aktarım onayı (asistan) | `modules/assistant/application/assistant.service.ts` (`ASSISTANT_CONSENT_REQUIRED`) |
| İzolasyon testleri | `apps/api/test/security.e2e-spec.ts` |
| Satış modülü yetki sınırı (mükellef verisine erişim yok, ayrı rol/anahtar) | migration `20261021090000_satis_modulu` (`sales_grant_access()`), `satis/api`, `satis/api/test/security.e2e-spec.ts`, docs/adr/0009 |

Ek kurallar:
- **Outbox olay yükü** uygulama içi bildirimi oluşturacak kadar veri taşıyabilir (ör. çalışan adı); işlenen olaylar 7 gün sonra silinir. Yüke T.C. kimlik no, sağlık ayrıntısı veya şifre konmaz.
- **WhatsApp/push gibi dış kanal** metni `externalBody`'dir ve mükellef unvanı, çalışan adı, T.C./VKN içermez; boşsa genel metin gider.
