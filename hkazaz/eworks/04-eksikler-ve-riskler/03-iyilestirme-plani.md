# 4.3 İyileştirme planı

> İlgili: [Mimari eksikler](01-mimari-yapisal-eksikler.md), [Güvenlik riskleri](02-guvenlik-riskleri.md), [Yönetici özeti](../01-yonetici-ozeti.md)
> Bu bir **öneridir**; kod sahibi (Mert) ve CTO onayıyla kesinleşir. Tahminler tek geliştirici-gün cinsinden kabadır.

## Faz A — Hemen (≈1 hafta): riskleri durdur

| İş | Kapatır | Tahmin |
|---|---|---|
| `auto_login` varsayılanını `False` yap; OCR yalnız öneri | G-01 | 0,5 g |
| Kullanıcı belgelerini koda eşitle (`Kullanim.md`, `GIB-Canli-Akis.md`, `robot-config.json`, köprü docstring) | M-14 | 0,5 g |
| İş bitince `jobs/<id>` silme + açılışta eski iş temizliği | G-04, M-16 | 1 g |
| `runtime/` `sys.path` satırını kaldır; hot-reload'u `EWORKS_DEV` bayrağına bağla | G-08 | 0,5 g |
| Supabase bölgesini ve yönetici erişim listesini belgele | G-05, G-11 | 0,5 g |
| Depo = kaynak gerçeği kararı; Mert'in çalışma kopyasını dala al, etiketle | M-15 | 1 g |

## Faz B — Kısa vade (2–4 hafta): sertleştir ve tekrarlanabilir yap

| İş | Kapatır | Tahmin |
|---|---|---|
| Edge: kısa ömürlü tek kullanımlık iş bileti; `robot` yalnız biletle | G-02, G-15 | 2 g |
| Vault erişim denetim tablosu + portalda "son erişimler" | G-03 | 1,5 g |
| Supabase MFA (TOTP), `aal2` olmadan `save`/`robot` reddi | G-12 | 1,5 g |
| CSP başlığı; inline JS'i dosyaya taşı; `innerHTML` noktalarını `textContent`'e çevir | G-06 | 3 g |
| Köprü GET'lerinde JWT; `/gib-sozlesmeler.json` kaldır | G-07 | 0,5 g |
| `supabase/migrations/` + CLI; idempotent olmayan betiği düzelt | M-05 | 2 g |
| CI: unittest (Chrome'suz küme) + node testleri + `supabase db reset` + `pip-audit` | M-10, G-09 | 2 g |
| `pip-compile --generate-hashes`; Edge'de tam sürüm | G-09 | 0,5 g |
| Yetim Vault sırrı tetikleyicisi + firma silme eylemi | G-10 | 1 g |
| Tek yapılandırma dosyası | M-06 | 1 g |
| Ölü kod ve eski CLI'yı kaldır (`gib_sozlesmeler`, `sistem_loglari` dahil) | M-04, M-13, G-14 | 1 g |
| JSON Schema: `eworks.gib.contracts.v1`, `eworks.declarations.sync.v1` | M-08 | 1 g |

## Faz C — Orta vade: Mükellef Takip ile birleşme (önerilen strateji)

Amaç: Eworks'ün özgün değeri olan **GİB okuma robotunu** korumak, portal + JSONB veri modelini Mükellef Takip'in çok kiracılı, DDD'li yapısına devretmek.

1. Mükellef Takip'te `data-intake` bağlamına `POST /api/import/gib-contracts` ve `/gib-declarations` uç noktaları; şema = Faz B'deki JSON Schema; kaynak türü `ROBOT`.
2. Kimlik: robot Supabase JWT yerine Mükellef Takip `ApiToken` (kapsam `gib:import`, kısa ömür, kiracıya bağlı).
3. GİB şifresi: Mükellef Takip `VaultService` ilkelerine uyum — otomatik giriş yok; kullanıcı CAPTCHA'yı ve "Giriş Yap"ı kendisi yapar.
4. PDF'ler Mükellef Takip `documents` bağlamına (içerik adresli, kiracı yolu).
5. Eworks portalı salt okunur moda alınır, veri dışa aktarılıp Mükellef Takip'e taşınır, sonra emekliye ayrılır.

Ayrıntılı alan eşlemesi: [../../mert-technical-analiz.md](../../mert-technical-analiz.md) §9. Mükellef Takip tarafında bu iş bir ADR ile kayda alınmalıdır (`mukellef-takip/docs/adr/`).

## Faz C'ye gidilmezse (Eworks ayrı ürün olarak kalırsa)

M-01 (ön yüz yeniden yapılandırma), M-02 (ilişkisel model), M-03 (büro/rol), M-11 (gözlemlenebilirlik) zorunlu hale gelir; kaba tahmin 6–10 hafta.

## İzleme

Her kapanan madde için ilgili tabloda **Durum** = "Kapandı (`<commit>`)" yazılır; bu dosyadaki satır üstü çizilmez, tarih eklenir.
