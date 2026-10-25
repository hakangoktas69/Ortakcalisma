# 1.2 · Ortak dil (ubiquitous language)

> Seviye 1. Önceki: [İş alanı](01-is-alani-ve-alt-alanlar.md) · Sonraki: [Bağlam haritası](03-baglam-haritasi.md)

Kullanıcıyla, ekip içinde ve kodda **aynı kelimeler** kullanılır. Arayüz ve belgeler Türkçe, kod tanımlayıcıları İngilizce; eşleme bu tablodadır. Bir terimin anlamı bağlama göre değişiyorsa "Bağlam" sütununda belirtilir — DDD'de bu normaldir, bir terimin her yerde aynı anlama gelmesi gerekmez.

## Temel terimler

| Türkçe (iş) | Kod | Bağlam | Anlamı |
|---|---|---|---|
| **Büro** | `Tenant` | identity (sahip), hepsi | Mali müşavirlik bürosu; sistemin müşterisi ve izolasyon birimi |
| Yönetici / Personel | `UserRole.ADMIN / STAFF` | identity | Büro içi roller |
| **Mükellef**, firma | `Company` | taxpayers | Büronun takip ettiği vergi mükellefi (şirket, şahıs, basit usul) |
| Mükellef türü | `CompanyType`: `SIRKET`, `SAHIS`, `BASIT_USUL` | taxpayers | Yükümlülükleri ve e-Defter son gününü belirler |
| VKN / TCKN | `taxNumber` | taxpayers | 10 hane (tüzel) / 11 hane (gerçek kişi, kontrol haneli) |
| **Yükümlülük** | `CompanyObligation` | tax-filing | Mükellefin vermesi gereken beyanname türleri |
| **Beyanname** | `Declaration` | tax-filing | Verilmiş bir beyanname kaydı (elle, eklentiyle veya demo GİB'den) |
| Beyanname türü | `DeclarationType`: `KDV1`, `MUHSGK`, `DAMGA`, `GECICI_VERGI`, `YILLIK_GELIR`, `KURUMLAR` | tax-filing | |
| **Dönem** | `period` | tax-filing, invoicing, payroll, social-security | `2026-09` (aylık), `2026-Q3` (üç aylık), `2026` (yıllık) |
| Kontrol ayı | `parseControlMonth` | tax-filing | Hangi son günlerin kontrol edildiği ay (varsayılan: önceki ay) |
| **Son gün** | `dueDate` | tax-filing | Yasal son gün; hafta sonuna denk gelirse ilk iş gününe kayar |
| Durum | `FILED` Verildi · `FILED_LATE` Geç verildi · `PENDING` Bekliyor · `LATE` Gecikti | tax-filing | `statusOf(dueDate, filedAt, now)` |
| Tahakkuk | `accrualAmount` | tax-filing | Beyannamede doğan vergi tutarı |
| **Berat** (e-Defter) | `EDefterBerat` | tax-filing | e-Defter yüklendi onayı; aylık ya da dönemsel tercih (`EDefterPreference`) |
| **e-Tebligat** | `ETebligat` | tebligat | GİB'in elektronik tebligatı |
| Tebliğ sayılma tarihi | `deemedServedAt` | tebligat | Ulaşmayı izleyen 5. günün sonu (VUK 107/A); süreler buradan başlar |
| İncelendi | `reviewedAt` | tebligat | Büro içi işaret; GİB'deki okunma durumunu değiştirmez |
| **İşyeri**, şube | `SgkWorkplace`, `isBranch` | social-security | SGK işyeri sicili; bir mükellefin birden çok işyeri olabilir |
| Sicil no | `registryNo` | social-security | 20+ haneli SGK işyeri numarası (boşluk/nokta biçimleri eşdeğer: `sameRegistry`) |
| **Vizite, e-Rapor** | `SgkReport` | social-security | Çalışanın istirahat raporu — **sağlık verisi** |
| Çalışmazlık onayı | `approveReport` | social-security | İşverenin SGK'ya "çalışmadı" bildirimi — **kuruma yazan işlem** |
| Vaka | `vaka` | social-security | 1 iş kazası, 2 meslek hastalığı, 3 hastalık, 4 analık |
| İşe giriş / işten ayrılış (4A) | `EmploymentEvent` `ENTRY/EXIT` | social-security | SGK tescil bildirgeleri (okuma) |
| **e-Bildirge** (APHB) | `EBildirgeDocument` | social-security | Aylık prim ve hizmet belgesi; mahiyet `ASIL / EK / IPTAL` |
| PEK | `premiumBase` / `sgkBase` | social-security, payroll | Prime esas kazanç |
| Kurum şifresi | `*Enc` alanlar | social-security | SGK web servis şifreleri — kasada şifreli |
| **Fatura**, ETTN | `Invoice`, `uuid` | invoicing | UBL-TR e-Fatura/e-Arşiv; yön `OUTGOING` satış / `INCOMING` alış |
| KDV ön kontrol | `kdvBuckets` | invoicing | Hesaplanan − tevkifat − indirilecek; beyanname yerine geçmez |
| **Bordro** | `PayrollRun`, `PayrollLine` | payroll | Bordro programının çıktısı (portal hesaplamaz) |
| Mutabakat | `reconcile` | payroll | Bordro ↔ e-Bildirge karşılaştırması (sayı, gün, PEK) |
| **Dilekçe**, şablon | `Petition`, `PetitionTemplate` | documents | `{{alan}}` yer tutuculu metin |
| **İş kutusu**, iş | `InboxItem` (saklanmaz) | workspace | Kaynak veriden türetilen yapılacak; kararlı anahtar `decl:<firma>:KDV1:2026-09` |
| Sonra hatırlat | `InboxSnooze` | workspace | Bir işi büro genelinde 1/3/7 gün erteleme |
| Önem | `late / soon / normal` | workspace | `severityForDue` |
| **Bildirim** | `Notification` | notifications | Uygulama içi duyuru; dış kanala giden metin `externalBody` (kişisel verisiz) |
| Rıza (WhatsApp) | `whatsappOptInAt` | notifications | Numaraya bağlı; numara değişince düşer |
| **Lisans**, kota | `Subscription.expiresAt`, `companyQuota` | billing | Büronun kullanım hakkı ve firma sınırı |
| Paket | `PLANS` | billing | `baslangic`, `pro`, `kurumsal` |
| **Eklenti anahtarı** | `ApiToken` | identity | Kapsamı `gib:import` olan, süreli anahtar |
| Oturum ailesi | `Session.familyId` | identity | Bir cihazın girişi; yenileme anahtarları aynı ailede döner |
| Uzmana Sor | `assistant` | assistant | Mevzuat asistanı; yurt dışı aktarım onayı `assistantConsentAt` |
| Kasa | `VaultService` | platform | Uygulama düzeyi şifreleme (AES-256-GCM, OpenBao) |
| Denetim kaydı | `AuditLog` | platform | Değiştirilemez, hash zincirli iz |

## Dil kuralları

1. Kodda yeni bir kavram adlandırmadan önce bu tabloya bak; yoksa **önce tabloya ekle**, sonra kodla.
2. Aynı kavram için iki kelime kullanma (ör. "firma" ve "mükellef" arayüzde eşanlamlı kabul edilir ama kodda yalnız `Company`).
3. Kurumların kendi terimlerini (SGK alan adları `TCKIMLIKNO`, `MEDULARAPORID`) yalnız **altyapı ayrıştırıcılarında / istemcilerinde** kullan; domain'e çevrilmiş adlarla girer (`tckn`, `medulaRaporId`). Bu, [anti-corruption layer](03-baglam-haritasi.md#anti-corruption-layer) ilkesidir.
4. Yasal dayanak yorumlarda kanun/madde ile yazılır (ör. `// VUK 107/A`, `// 5510 md. 81`).
