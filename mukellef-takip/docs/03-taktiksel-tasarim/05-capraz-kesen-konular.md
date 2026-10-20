# 3.5 Çapraz kesen konular

> Kod: `apps/api/src/platform/`, `apps/api/src/shared-kernel/` · Ayrıntılı tehdit modeli: [Güvenlik mimarisi](../04-mimari/03-guvenlik-mimarisi.md) · Kurallar: [security-kvkk.md](../ai/security-kvkk.md)

Her bağlamın kullandığı ama hiçbirine ait olmayan yetenekler `platform/` altındadır ve **iş kuralı içermez** (dependency-cruiser `platform-is-kurali-icermez`).

| Konu | Modül | Bağlamın yapması gereken |
|---|---|---|
| Kiracılık (multi-tenancy) | `platform/database/{tenant-context,rls-pool,prisma.service}.ts` | Hiçbir şey — `AuthGuard` büroyu bağlama yazar. Sistem yolu gerekiyorsa `runAsSystem`/`runAsTenant` |
| Kimlik ve yetki | `identity/interface/http/auth.guard.ts` (`AuthGuard`, `AdminGuard`) | Controller'a `@UseGuards(AuthGuard)`, yönetici uçlarına ek `@UseGuards(AdminGuard)`. Guard'lar **açıkça** eklenir: guard'sız uç herkese açıktır — yalnız açık gerekçeyle (ör. iyzico geri dönüşü, sağlık kontrolü) ve testle |
| Kişisel veri şifreleme | `platform/crypto/{vault.service,kms,personal-data}.ts` | TCKN / ad soyad / sağlık alanını `PersonalDataService.seal/open` ile yazmak/okumak |
| Kurum şifreleri (SGK) | `VaultService.encrypt/decrypt` | Düz şifreyi asla saklamamak, log'lamamak, yanıtta döndürmemek |
| Denetim kaydı | `platform/audit/audit.service.ts` | Kişisel/hassas veriye **erişen** veya **değiştiren** her eylemde `audit.log({ action, target, detail })` |
| Olaylar | `platform/events/` | [3.3](03-olaylar-ve-outbox.md) |
| Yapılandırma | `platform/config/config.ts` (zod) | Yeni ortam değişkenini şemaya eklemek; sırlar `*_FILE` desteğiyle |
| Loglama | `platform/logging/logging.module.ts` (pino) | `console` kullanmamak; `Logger`; PII alanları otomatik maskelenir ama mesaja PII yazmamak |
| Hız sınırı | `platform/security/security.module.ts` (`@nestjs/throttler` + Redis) | Pahalı/hassas uca `@Throttle(RATE_LIMITS.auth)` (10/dk, 15 dk blok) veya `@Throttle(RATE_LIMITS.heavy)` (20/dk) |
| HTTP hata çevirisi | `platform/http/prisma-exception.filter.ts` | Benzersizlik ihlalini yakalamaya gerek yok (409 döner); iş hatasını Nest istisnasıyla atmak |
| Dosya / tablo | `platform/files/spreadsheet.ts`, `shared-kernel/table-text.ts` | Excel/CSV okurken bunları kullanmak |

## Kiracılık: iki savunma hattı

```mermaid
flowchart LR
  R[İstek] --> G[AuthGuard: token → user → setCurrentTenant]
  G --> S[Servis: where tenantId / companyId ∈ büro]
  S --> P[rls-pool: set_config app.tenant_id]
  P --> DB[(PostgreSQL RLS politikası<br/>tenantId = app_tenant())]
```

1. **Uygulama:** servisler sorgularında büroyu yine de filtreler (okunabilirlik, doğru 404).
2. **Veritabanı (RLS):** filtre unutulsa bile başka büronun satırı dönmez. Bağlam yoksa hiçbir satır görünmez (*fail-closed*).

Alt tablolar (ör. `PayrollLine`) `EXISTS` ile ebeveynin büro politikasına bağlanır. Rol düzeni: `mukellef_owner` (migration, BYPASSRLS), `mukellef_app` (uygulama, tablo sahibi değil), `AuditLog` için UPDATE/DELETE geri alınmış. Ayrıntı: [Veri modeli](../04-mimari/02-veri-modeli.md), [ADR 0004](../adr/0004-postgres-rls.md).

## Kişisel veri: sınıflandırma → teknik önlem

| Sınıf | Örnek | Saklama | Dış kanala/LLM'e |
|---|---|---|---|
| Özel nitelikli (KVKK md.6) | e-Rapor (vaka türü, tarihler) + kişi | Kimlik alanları şifreli (`tcknEnc`, `fullNameEnc`) → sağlık kaydı anahtarsız kişiye bağlanamaz; en az alan | **Asla** |
| Kişisel | TCKN, ad soyad, telefon, e-posta | TCKN/ad şifreli + HMAC blind index (`tcknHash`); ekranda maskeli | Maskeleme sonrası, onaylı |
| Gizli (kurum erişimi) | SGK Vizite/4A şifreleri, iyzico/Meta/Claude anahtarları | KMS ile şifreli kolon / Docker secret (GİB şifresi **hiç saklanmaz**) | Asla |
| İşletme verisi | Unvan, VKN, beyanname durumu | Düz (RLS ile yalıtık) | Gerekirse |

Şifreleme biçimi `v2:<anahtar-sürümü>:...` (OpenBao Transit) veya `v1:` (yerel anahtar, geçiş). Okuma ikisini de çözer; yazma her zaman güncel biçimdir. Ayrıntı: [ADR 0005](../adr/0005-openbao-kms.md).

## Denetim kaydı

- Büro başına **hash zinciri** (`platform/audit/audit-chain.ts`): her kayıt bir öncekinin hash'ini içerir; araya kayıt eklemek, değiştirmek veya silmek zinciri bozar (`verifyAuditChain`).
- Veritabanı rolü `AuditLog`'u güncelleyemez/silemez.
- Ne yazılır: giriş/çıkış, şifre/2FA, kullanıcı yönetimi, kurum şifresi kaydı, GİB/SGK aktarımı, SGK'ya yazan işlemler, rapor dışa aktarma, ödeme, asistan kullanımı. `detail`'e **kişisel veri ve soru metni yazılmaz**.

## Zaman, dil, para

- Arayüz ve hata mesajları Türkçe; tarih `tr-TR`, para `TL` iki hane (`roundKurus`).
- Türkçe büyük/küçük harf dönüşümünde `toLocaleUpperCase('tr-TR')` (I/İ). Tablo eşleştirme `table-text.ts` ile.
