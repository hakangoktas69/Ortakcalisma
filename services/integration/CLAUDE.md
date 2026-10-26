# services/integration — kurum entegrasyonu (Python ACL)

Bu bir bounded context değil, **anti-corruption layer**'dır: kurumla (GİB/SGK) konuşur, ham veriyi `contracts/integration/*.schema.json` diline çevirir. Yapı ve komutlar: [README.md](README.md). DDD'deki yeri: [DDD rehberi §2.5](../../docs/gelistirici-rehberi/ddd.md#25-bağlamlar-arası-ilişkiler).

- **Alan kuralı yok, tablolara yazma yok.** Son gün, eşleme, kabul kuralı TypeScript bağlamlarındadır; sonucu `apps/worker` uygular.
- Kurumlar birbirini, taşıma katmanı kurumları import etmez (`lint-imports`).
- Kuruma giden her istek merkezi hız sınırlayıcıdan (`core/hiz.py`, Redis GCRA) geçer; hesap başına sahte/dönüşümlü IP ve kurum denetimini atlatma yöntemi yazılmaz (K-22). Zamanlanmış iş kuruma yazmaz.
- Erişim yolu: oturum açılışı her zaman tarayıcıda; oturum sonrası hizmet başına `robot` | `servis` — kurum varsayılanı `GIB_ERISIM_YOLU` / `SGK_ERISIM_YOLU` (vars. `servis`), hizmet bazında `ERISIM_<KURUM>_<HİZMET>`; politikası olmayan hizmette `servis` açılışta reddedilir (D38, [02 §1b](../../docs/hedef-mimari/02-kurum-entegrasyon-robotu.md#1b-erişim-yolu-parametresi-d38)). `servis` resmi web servis değildir; iki yol da aynı şemayı üretir ve aynı testleri (`erisim` parametreli) geçer. Kuruma giden yeni istek türü servis yolunda izinli alan listesi ve kapsam doğrulaması olmadan gönderilmez.
- Kurum şifresi yalnız bellekte; log'a, hataya, diske, sonuca girmez. `wrong_password` alan hesap yeniden denenmez.
- Çıktı şeması değişirse `contracts/` şeması, TS uygulayıcısı ve iki taraftaki sözleşme testleri aynı değişiklikte; sürüm yükseltilir (`*.v2`).
- TDD: testler sahte kurum sunucusuna (`tests/sahte_kurumlar`) karşı; önce kırmızı. `@pytest.mark.feature("<anahtar>")` ile bağlanır. Sahte sunucu yalnız **doğrulanmış** kurum davranışını taklit eder; bilinmeyen davranış uydurulmaz, açık konuya yazılır. Sahte geçen işlem canlı doğrulama ister (D33).
- Fikstürde gerçek mükellef/VKN/kurum çıktısı yok. Ayrıştırıcı kapsamı %90.
