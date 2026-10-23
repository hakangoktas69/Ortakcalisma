# Eworks durumu ve açık riskler

> İşe başlamadan bu dosyaya bak. Son güncelleme: 2026-10-23, kaynak `51e2cd1` (kaynak tarihi 21.10.2026).

## Durum

| Alan | Durum |
|---|---|
| Sözleşme listesi okuma | Canlı doğrulandı 17.10.2026 (274 sözleşme, commit sürüm 7) |
| e-Beyanname listesi, beyanname/tahakkuk PDF, MUHSGK SGK belgeleri, çalışan sayısı | Kodlu, sentetik testli; canlı tam tarama iddia edilmez |
| e-Defter, e-Tebligat | Menü/adaptör var, tamamlanmadı |
| Otomatik giriş (OCR + tıklama) | 21.10 sürümünde açık (`8cb6397`); belgeler hâlâ "kullanıcı girer" diyor |
| Test | `VALIDATION.md` 48 testlik küme yeşil; tam küme değil; CI yok |
| Kaynak | Depo = paylaşım kopyası; canlı portal ve 2. yöntem (`02-developer-servis-denemesi`) depoda değil |
| Belgeler | `hkazaz/eworks/` 23.10.2026'da oluşturuldu |

## Açık riskler (önem sırası)

Kritik: **G-01** otomatik GİB girişi · **G-02** geçerli JWT + Origin'siz istek → GİB şifresi düz metin.
Yüksek: **G-03** Vault okuma denetimi yok · **G-04** `jobs/` altında süresiz kişisel veri · **G-05** KVKK yurt dışı aktarım/saklama/imha · **G-06** CSP yok + `innerHTML`.
Orta: G-07 köprü GET uçları · G-08 hot-reload/`runtime` · G-09 bağımlılık sabitleme · G-10 yetim Vault sırları · G-11 yönetici erişimi · G-12 MFA yok.
Ayrıntı ve kanıt: `../04-eksikler-ve-riskler/02-guvenlik-riskleri.md`.

Mimari: M-01 tek dosya ön yüz · M-02 tek JSONB · M-03 büro/rol yok · M-05 migration yok · M-09 GİB DOM bağımlılığı · M-10 test/CI · M-15 kaynak gerçeği · M-17 Mükellef Takip örtüşmesi. Ayrıntı: `../04-eksikler-ve-riskler/01-mimari-yapisal-eksikler.md`.

## Plan (öneri, onay bekliyor)

- **Faz A (≈1 hafta):** `auto_login=False`, belge-kod eşitleme, `jobs/` temizliği, `runtime` + hot-reload kapatma, bölge belgeleme, kaynak gerçeği.
- **Faz B (2–4 hafta):** Edge iş bileti, Vault erişim denetimi, MFA, CSP, migrations, CI, kilitli bağımlılıklar, JSON Schema.
- **Faz C:** robotu Mükellef Takip `data-intake`'e veri kaynağı yap, Eworks portalını dondur.

Ayrıntı: `../04-eksikler-ve-riskler/03-iyilestirme-plani.md`. Bir madde kapanınca bu dosyayı ve ilgili tabloyu aynı değişiklikte güncelle.
