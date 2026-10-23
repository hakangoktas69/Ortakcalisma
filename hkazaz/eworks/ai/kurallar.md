# Eworks kuralları

> Kod değişikliğinde uyulacak kurallar. Gerekçeler: `../02-mimari/04-guvenlik-mimarisi.md`, `../04-eksikler-ve-riskler/02-guvenlik-riskleri.md`.

## Pazarlıksız kurallar

1. **Service-role yalnız Edge'de.** Tarayıcı ve robot publishable key + kullanıcı JWT'si kullanır. `logger_service.py` `sb_secret_` önekini reddeder; bu kontrolü kaldırma.
2. **GİB şifresi yalnız Vault'ta.** Tarayıcıya dönen yanıtta şifre olmaz (`status` yalnız `{configured, updatedAt}`). Robot şifreyi bellekte kullanır, doldurduktan sonra değişkeni temizler; diske, `status.json`'a, log'a, stdout'a yazılmaz.
3. **Kimlik istemciden alınmaz.** Edge ve SQL fonksiyonları kullanıcıyı JWT'den (`auth.uid()` / `admin.auth.getUser`) belirler; gövdeden gelen `user_id`/`ownerId` yalnız eşleştirme içindir.
4. **Robot DB'ye yazmaz.** Kalıcı kayıt portaldan `eworks_commit` ile; robotun tek yazma yetkisi kullanıcının Storage klasörüne içerik adresli PDF.
5. **Fail-closed.** Altbilgi toplamı ≠ satır sayısı, beklenmeyen başlık, eksik sayfa, şema hatası → kayıt yok, kullanıcıya açık mesaj.
6. **Köprü güvenliği.** Yeni POST ucu: Host + Origin + `X-Eworks-Token` + `verify_owner(JWT)` + en küçük gövde sınırı. Yeni GET ucu kişisel veri döndürüyorsa JWT de ister. Bağlama adresi `127.0.0.1` kalır.
7. **Otomatik GİB girişi genişletilmez.** Yeni kodda `CaptchaAssist(auto_login=False)`; mevcut `True` kullanımları açık risk G-01'dir, karar beklemektedir.
8. **GİB host allowlist'i dışına çıkılmaz**; yeni alan adı gerekiyorsa allowlist yardımcısına eklenir ve gerekçe yazılır.
9. **Kişisel veri:** VKN/TCKN, unvan, SGK çalışan bilgisi log'a, hata mesajına, test fikstürüne, belgeye, ekip hafızasına girmez. Log için `logger_service._safe_message` örüntüsü. Diske yazılan her kişisel veri için silme yolu tanımlanır.
10. **Sırlar ve canlı değerler commit edilmez:** Supabase URL/anahtar (şablon `YOUR_PROJECT…` kalır), `.env`, `jobs/`, `incoming/`, PDF, XLS, ekran görüntüsü.

## Kod üslubu

- Mevcut dosyanın üslubuna uy (Python: kısa yoğun satırlar, Türkçe tek satır docstring). Yeni modülde PEP 8'e yakın, tip ipuçlu yazım tercih edilir.
- Robot sonuçları sürümlü şema: `eworks.<alan>.<ad>.v<N>`; kırıcı değişiklik = yeni sürüm, köprü ve portal aynı değişiklikte güncellenir.
- Ara dosyalar `local_files` ile atomik yazılır.
- Kullanıcıya dönen mesaj sabit Türkçe metin; `str(exc)` doğrudan arayüze verilmez.
- Ön yüzde HTML üretirken her dinamik değer `safe()`'ten geçer; mümkünse `textContent`.
- Yinelenen sabitler (`HEADERS`/`FIELDS`, köken yardımcıları) için yeni kopya üretme; mevcut olanı içe aktar.

## SQL

- İdempotent: `if not exists`, `drop policy if exists` + `create policy`, `create or replace function`.
- SECURITY DEFINER → `set search_path = ''`, tam nitelikli adlar, ilk satırda `auth.uid()` kontrolü, `revoke … from public, anon, authenticated` + gerekli `grant`.
- RLS'e dayanan yeni tablo `eworks_security_check()` kapsamına alınır.
- Migration aracı yok: değişiklik hem `E1/Eworks-Portal/*.sql`'e hem `hkazaz/docker/mert/supabase/migrations/` denemesine işlenir.

## Test

- Her hata düzeltmesi önce kırmızı sentetik testle; fikstürler sahte kimlik (`1111111111`) ve sahte unvan kullanır.
- Güvenlik kontrolü içeren her uca en az bir "reddedilmeli" testi.
- İş bitmeden: `VALIDATION.md` kümesi (48 test) yeşil, `node test_edge_function.mjs` yeşil; koşulamayan adımı kullanıcıya açıkça söyle.
- Canlı GİB doğrulaması yalnız hesap sahibinin izniyle; sonuç tarih + sayılarla `GIB-Canli-Akis.md`'ye.

## Belgeler

Davranış değişirse aynı değişiklikte: kullanıcı belgesi (`E1/Eworks-Portal/*.md`), `hkazaz/eworks` ilgili sayfa, `04-eksikler-ve-riskler` tablolarında **Durum**, `ai/durum-ve-riskler.md`.
