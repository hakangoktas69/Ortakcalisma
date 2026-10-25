# 2 · Bounded context kataloğu

> Seviye 2. Önceki: [İş akışları](../01-stratejik-tasarim/04-is-akislari.md) · Sonraki: [Taktiksel tasarım](../03-taktiksel-tasarim/01-katmanlar.md)

Her bağlam `apps/api/src/modules/<ad>/` altındadır ve aynı şablonla belgelenir.

| Bağlam | Alt alan | Tek cümle | Sayfa |
|---|---|---|---|
| identity | Genel | Büro politikası, kullanıcı, giriş, 2FA, oturum, eklenti anahtarı | [identity.md](identity.md) |
| taxpayers | Destekleyici (paylaşılan varlık) | Mükellef kartı ve Excel/CSV aktarımı | [taxpayers.md](taxpayers.md) |
| tax-filing ★ | Çekirdek | Yükümlülük, beyanname kontrol matrisi, son günler, e-Defter | [tax-filing.md](tax-filing.md) |
| tebligat | Destekleyici | e-Tebligat, tebliğ sayılma, büro içi inceleme | [tebligat.md](tebligat.md) |
| social-security ★ | Çekirdek | SGK işyeri, kurum şifreleri, Vizite e-rapor, 4A, e-Bildirge | [social-security.md](social-security.md) |
| invoicing | Destekleyici | UBL-TR fatura aktarımı, KDV ön kontrol | [invoicing.md](invoicing.md) |
| payroll | Destekleyici | Bordro aktarımı, satır kontrolleri, e-Bildirge mutabakatı | [payroll.md](payroll.md) |
| billing | Genel | Lisans, kota, iyzico ödeme | [billing.md](billing.md) |
| documents | Destekleyici | Dilekçe şablonları ve arşiv | [documents.md](documents.md) |
| assistant | Destekleyici | Mevzuat asistanı (maskeleme, onay, kota) | [assistant.md](assistant.md) |
| notifications | Genel | Bildirim merkezi, hatırlatıcı, WhatsApp, olay aboneleri | [notifications.md](notifications.md) |
| workspace ★ | Çekirdek (okuma modeli) | İş kutusu, genel bakış, CSV raporlar | [workspace.md](workspace.md) |
| data-intake | Destekleyici (ACL) | Eklentinin kurum sayfası aktarımı → bağlamlara dağıtım | [data-intake.md](data-intake.md) |

## Sayfa şablonu (yeni bağlam eklerken kopyala)

```markdown
# <bağlam>
> Alt alan: … · Kod: apps/api/src/modules/<bağlam>/ · Şema: prisma/schema/<bağlam>.prisma

## Sorumluluk
Ne yapar / ne yapmaz (sınır).

## Model
Aggregate'ler, kimlik, değişmezler (invariant), yaşam döngüsü.

## İş kuralları (domain)
Saf fonksiyonlar, yasal dayanak.

## Kullanım senaryoları (application)
Servis metotları; transaction ve yetki notları.

## HTTP uçları
| Metot | Yol | Yetki | Not |

## Olaylar
Yayınladığı / dinlediği.

## Bağımlılıklar
index.ts üzerinden kullandıkları, dış servisler (ACL).

## Güvenlik ve KVKK

## Testler
Birim ve e2e dosyaları.

## Bilinen sınırlar ve genişletme noktaları
```
