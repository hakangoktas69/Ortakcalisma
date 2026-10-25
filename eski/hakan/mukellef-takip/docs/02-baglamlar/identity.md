# identity

> Alt alan: Genel (güvenlik kritik) · Kod: `apps/api/src/modules/identity/` · Şema: `prisma/schema/identity.prisma` · Kalıp: **Open Host Service**

## Sorumluluk

Kim olduğunu doğrular ve hangi büroya ait olduğunu belirler. Büro güvenlik politikası (2FA zorunluluğu), kullanıcı yönetimi, giriş/çıkış, iki adımlı doğrulama, cihaz oturumları, eklenti anahtarları.
**Yapmaz:** iş verisine yetki kararı vermez (o, her bağlamın `tenantId` filtresi + RLS'tir); lisans (billing).

## Model

| Toplam (aggregate) | Kimlik | Değişmezler |
|---|---|---|
| `User` | `id`, benzersiz `email` | Büroda **en az bir aktif yönetici** kalır · kendini devre dışı bırakamaz · `sessionVersion` arttığında eski erişim anahtarları geçersiz · 5 hatalı girişte `lockedUntil` = +15 dk |
| `Session` (oturum ailesi) | `familyId` | Yenileme anahtarı **tek kullanımlık** (`replacedAt`) · kullanılmış anahtar tekrar gelirse aile iptal · `sessionVersion` kullanıcınınkiyle eşleşmeli |
| `ApiToken` | `tokenHash` (SHA-256) | Kapsam `gib:import` · süreli (`expiresAt`) · sahibi pasif / 2FA zorunlu ama kurmamışsa çalışmaz |
| `Tenant` (politika kısmı) | `id` | `require2fa` açmak için yöneticinin kendi 2FA'sı açık olmalı |

Şifre özeti argon2id (`infrastructure/password-hasher.ts`); eski bcrypt girişte dönüştürülür (`needsRehash`). TOTP gizli anahtarı kasada şifreli.

## İş kuralları (domain)

- `domain/totp.ts` — RFC 6238: `hotp`, `verifyTotp` (±1 adım, son kullanılan adım tekrar kabul edilmez), `generateRecoveryCodes` (10 adet, karışabilen karakter yok), `hashRecoveryCode`.
- Şifre kuralı: ≥ 10 karakter, harf + rakam (`checkPasswordPolicy`); geçici şifre üretimi `generateTempPassword`.

## Kullanım senaryoları (application)

| Servis | Metot | Not |
|---|---|---|
| `AuthService` | `login`, `loginSecondFactor`, `refresh`, `changePassword`, `setupTotp`, `enableTotp`, `disableTotp` | Giriş akışları **sistem bağlamında** (`runAsSystem`): büro henüz bilinmez. Kayıtsız e-postada sahte özetle aynı süre harcanır (zamanlama saldırısı) |
| `SessionService` | `start`, `rotate`, `isFamilyActive`, `list`, `revokeForUser`, `logout` | Yarış durumunda tek yenileme: `updateMany where replacedAt null` |
| `ApiTokenService` | `create`, `list`, `revoke`, `verify` | Düz anahtar yalnız oluşturulurken bir kez döner |

Guard'lar (`interface/http`): `AuthGuard` → `verifySession` (JWT + DB: aktif mi, `sessionVersion`, rol DB'den, aile açık mı, şifre değiştirme / 2FA kurulum zorunluluğu) → `setCurrentTenant`. `ImportGuard` aynı + eklenti anahtarı. `AdminGuard` rol kontrolü.

## HTTP uçları

| Metot | Yol | Yetki | Not |
|---|---|---|---|
| POST | `/api/auth/login`, `/login/2fa`, `/refresh` | oturumsuz, hız sınırı 10/dk | |
| POST | `/api/auth/logout` · GET/DELETE `/api/auth/sessions[/:familyId]` | oturum | |
| GET | `/api/auth/me` | oturum (zorunluluklarda da açık) | |
| POST | `/api/auth/password`, `/2fa/setup`, `/2fa/enable`, `/2fa/disable` | oturum | sessionVersion artar → yeni oturum döner |
| GET/POST/DELETE | `/api/tokens[/:id]` | oturum | |
| GET/POST/PATCH | `/api/users`, `/:id`, `/:id/reset-password`, `/:id/reset-2fa`, GET/PUT `/policy` | ADMIN | |

## Olaylar

Yayınlamaz (gelecekte `identity.user.disabled`). Denetim kaydına yazar: `auth.login`, `auth.password.change`, `auth.2fa.*`, `auth.session.reuse-detected`, `user.*`, `token.*`, `policy.2fa.*`.

## Bağımlılıklar

Yalnız `platform` (Prisma, Vault, Audit). Diğer bağlamlar bunu `index.ts`'ten kullanır: `AuthGuard`, `AdminGuard`, `ImportGuard`, `CurrentUser`, `AuthUser`.

## Güvenlik ve KVKK

Erişim anahtarı ömrü `ACCESS_TOKEN_TTL` (şimdilik 8 saat; web BFF'e geçince 15 dk — [ADR 0006](../adr/0006-bff-cerez-oturum.md)). Yanıtlarda şifre özeti, TOTP sırrı, anahtar özeti dönmez (e2e testinde kontrol).

## Testler

`domain/totp.spec.ts`, `infrastructure/password-hasher.spec.ts`, `interface/http/auth.guard.spec.ts` · e2e: `test/identity.e2e-spec.ts` (22 senaryo: kilit, 2FA tam akış, politika, oturumlar, anahtarlar, kullanıcı yönetimi, son yönetici kuralı), `test/security.e2e-spec.ts`, `test/throttle.e2e-spec.ts`.

## Bilinen sınırlar ve genişletme

Web hâlâ `localStorage`'da erişim anahtarı tutuyor (Faz 3). Oturum listesi ve asistan onayı için web ekranı yok (API hazır). SSO/OIDC yok.
