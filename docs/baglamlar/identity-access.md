<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->
[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Bağlamlar](README.md) › **identity-access**
<!-- /gezinti -->

# identity-access — Kimlik ve yetki

> Durum: **B aşaması (2026-10-25)**: giriş, oturum, rol şablonları ve miraslı yetki. MFA ve yetki yönetim ekranı yok. Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil), [05 §3](../hedef-mimari/05-yetki-ve-hesap-modeli.md). Kod: `packages/contexts/identity-access` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | Kullanıcı, oturum, MFA, yetki ağacı, rol şablonları, kişiye özel izin, personel ataması |
| Aggregate'ler (kök) | `User`, `Role`, `PermissionOverride`, `StaffAssignment` |
| Yayınladığı olaylar | `PermissionsChanged` |
| Özellik anahtarları | `oturum.*`, `yonetim.kullanicilar.*`, `ayarlar.profil.*` |
| Veritabanı şeması | `identity_access` (shard), kimlik GoTrue'da (kontrol düzlemi) |

## Kurallar

- Yetki ağacı = özellik ağacı. Üst düğüme verilen yetki alt düğümlere miras kalır; en özel kural kazanır, eşitlikte engel kazanır (`domain/permissions.ts`).
- Etkin yetki = rol şablonu ∪ kişiye özel izin − kişiye özel engel. Şablonlar 05 §3.2'dir: `ofis_admin` (kurum hız politikası hariç), `musavir`, `personel` (senkron başlatamaz, kurum bilgisi giremez), `mukellef` (kendi firması; kurum bilgisi girer ve onay verir).
- Yetki yükseltme yasaktır (`escalations`): veren sahip olmadığı yetkiyi veremez; personel ve mükellef yetki veremez.
- Oturum Redis'tedir. Tarayıcıya yalnız HttpOnly + SameSite=Strict opak çerez gider; GoTrue belirteçleri sunucuda kalır ve süresi dolmadan yenilenir.
- Değişiklik yapan her BFF isteği: aynı köken + CSRF belirteci + yetki anahtarı (`authorize`).
- RLS: `app.is_member(org)` etkin ofis claim'i ve üyelik ister. Üyelik, rol ve izin yazımı yalnız sistem bağlamındadır (hesap açma).

## BFF uçları ve ekranlar

- `POST /api/oturum/giris` (form; köken denetimi, hata nedeni ayrıntılandırılmaz), `POST /api/oturum/cikis` (CSRF), `GET /api/saglik`.
- Ekranlar: `/giris`; panel kabuğu menüyü yetkiye göre süzer; yetkisiz sayfada 403 görünümü.

## Testler

- Birim: `test/domain/permissions.test.ts`, `test/application/session.test.ts`.
- Entegrasyon (gerçek GoTrue + shard + Redis): `test/infrastructure/giris.int.test.ts`; pgTAP `supabase/tests/tenant/identity_access/uyelik.sql`.
- Kabul: `apps/web/e2e/giris.e2e.ts` (4 ekran) — `oturum.giris.login` yeşil.

## Açık işler

- MFA (`oturum.mfa`), şifre sıfırlama (SMTP gerekir), çok ofisli kullanıcı için ofis değiştirme, kullanıcı ve yetki yönetim ekranları (`yonetim.kullanicilar`).

<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->

---

[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Bağlamlar](README.md) › **identity-access**
<!-- /gezinti -->
