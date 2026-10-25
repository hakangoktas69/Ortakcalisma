# Kurallar

> Kod ve belge değişikliğinde uyulacak kurallar. Gerekçeler hedef mimari belgelerinde ve [karar kaydında](../adr/karar-kaydi.md).

## Pazarlıksız kurallar

1. **Kiracı izolasyonu.** Her kiracı tablosu `org_id` taşır, PK `(org_id, id)` ile başlar, RLS politikası ve pgTAP testi vardır. Uygulama da `org_id` ile filtreler (RLS ikinci savunmadır). Başka ofisin kaydı → 404.
2. **Kurum şifreleri** yalnız Vault'ta; yanıt, log, hata mesajı, `status`, diske yazılmaz. Robot/servis işçisi şifreyi bellekte kullanır; her okuma `audit`'e yazılır.
3. **Hesap kullanımı:** müşavir mükellefin kurum hesabını yalnız mükellef onayıyla (`CredentialConsent`) kullanır; mükellef müşavirin hiçbir bilgisini kullanamaz — veritabanı tetikleyicisi, BFF ve işçi üçü de denetler (D18). İşçi iş başlarken kullanım hakkını yeniden doğrular.
4. **Tarayıcıda gizli bilgi yok** (D5): token, Supabase adresi/anahtarı, arka uç adresi, `NEXT_PUBLIC_*` yok. Oturum Redis'te, `__Host-` HttpOnly çerez, CSRF koruması.
5. **Kurum istekleri** merkezi hız sınırlayıcıdan geçer (kurum, hesap ve toplam bazında parametre); bağlantı hatasında hız düşer. Hesap başına sahte/dönüşümlü IP, kurum erişim denetimini atlatma yöntemi tasarıma alınmaz (K-22); gerekçe yazılır ve meşru alternatif önerilir.
6. **Kuruma yazan işlem** yalnız açık kullanıcı eylemiyle ve denetim kaydıyla; zamanlanmış iş yalnız okur.
7. **Fail-closed:** sayı/başlık/şema uyuşmazlığında sonuç uygulanmaz, kullanıcıya açık mesaj verilir.
8. **Kişisel veri** (VKN/TCKN, ad soyad, SGK çalışan bilgisi, sağlık verisi) log'a, hata mesajına, analitik/olay yüküne (gerekmedikçe), test fikstürüne, belgeye, ekip hafızasına girmez. Ekranda maskelenir (`maskTaxId`). Fikstürde `@eworks/testing` sahte üreticisi.
9. **Sırlar** commit edilmez: `.env`, anahtar, Supabase URL/anahtarı, `jobs/`, PDF, XLS, ekran görüntüsü. Yalnız `.env.example` (boş değerler).
10. **Yetki:** her sayfa, BFF ucu ve server action `feature-registry`'den tek bir anahtar bildirir; yetki yükseltme yasak; her yetki değişikliği denetim kaydına yazılır.

## Kod

- TypeScript paketleri derleme adımı olmadan kaynak olarak kullanılır: içe aktarmalar `.ts` uzantılı, yalnız silinebilir sözdizimi (`enum`/`namespace` yok; `erasableSyntaxOnly`).
- Domain saf: Supabase, Redis, `process.env`, `Date.now()`, rastgele yok — `Clock`/kimlik üreteci portla gelir. Beklenen hata `Result` değeridir.
- Bağlam dışına yalnız `src/index.ts` açılır; başka bağlamın tablosuna sorgu yok; yan etki olayla (outbox).
- Kullanıcıya dönen mesaj sabit Türkçe metindir; `String(error)` arayüze verilmez.
- **Hata ve log:** beklenmeyen hata yalnız sınırda (BFF ucu, işçi tüketicisi, ACL işi) yakalanır; bilinen durum (ör. kapsam dışı → 404) ile altyapı hatası (→ 500) aynı yanıta katlanmaz ve altyapı hatası loglanmadan yutulmaz. İş olayı ve yetki değişikliği denetim kaydına (`audit`), işletim bilgisi (hata, iş süresi, kurum sonuç kodu) operasyon loguna gider. Loga `org_id`, `job_id`, hata kodu, süre, sayı girer; kişisel veri, şifre, token, istek gövdesi, kurum yanıt içeriği girmez.
- Migration bağlam önekli (`20261101_0001_portfolio__taxpayers.sql`), idempotent; `SECURITY DEFINER` fonksiyonda `search_path = ''` ve tam nitelikli adlar.
- Python ACL alan paketini import etmez, kurumlar birbirini import etmez (`uv run lint-imports`); çıktı `contracts/` şemasına uyar.

## Kararlar ve belgeler nasıl işlenir

Her yeni karar **aynı değişiklikte** dört yere işlenir:

1. [hedef-mimari/01](../hedef-mimari/01-cok-kiracili-hedef-mimari.md) karar tablosu (`D-NN`, sırayla);
2. [docs/adr/karar-kaydi.md](../adr/karar-kaydi.md) (`K-NN`); uzun gerekçe gerekiyorsa ayrıca `docs/adr/NNNN-*.md`;
3. [docs/ai/durum.md](durum.md);
4. ekip hafızası (`eworks-hedef-mimari`).

İlgili ayrıntı belgesi ve bağlam sayfası da güncellenir. Açık konular ekip hafızasında (`eworks-acik-konular`) ve `durum.md`'de durur; kapanan madde silinir ve kararı işlenir. Yanıtın kapsamı belirsizse varsayım yapılmaz, açık konuya yazılır ve sorulur.

Belge değişikliğinden sonra: göreli bağlantılar (`node tools/docs/baglanti-denetle.mjs`), mermaid çizimi, hafıza değiştiyse `node tools/claude/check-memory.mjs`. Klasör taşıma, başkasının alanına yazma gibi geri alınması zor işlerde önce kapsam sorulur.

## Dal, commit, birleştirme

İş başında `dev`'den kişisel dal açılır (`<ad>/<kısa-iş>`), iş bitiminde orada commitlenir. Ortak dallara (`main`, `master`, `dev`, `yeniden-yapilanma`) doğrudan commit yok; pre-commit kancası reddeder (D37). `dev`'e birleştirme: önce `dev`'in güncellemeleri kişisel dala çekilir (merge, rebase değil), çatışma kişisel dalda iki tarafın hedeflediği işlev kodda analiz edilerek çözülür (iş kuralı çelişkisi, belirsiz amaç ya da hassas alan → kullanıcıya sorulur), doğrulamalar yeniden koşulur, sonra `--no-ff` birleştirilir (`tools/ajan/birlestir.mjs`). `dev` push'u her seferinde kullanıcı onayıyla. `dev` → `main` birleşimini kod sahibi yapar (PR, `.github/pull_request_template.md`). Hassas alan (`tools/ajan/ortak.mjs` `HASSAS_ALANLAR` → `.github/CODEOWNERS`, `@hkazaz`) değişikliğini kod sahibi onaylar. Yeni bağımlılık sabit sürümle, lisans ve güvenlik açığı denetimiyle eklenir.

Commit: Türkçe, kısa başlık (ne yapıldığı). Üretilen dosyalar (`AGENTS.md`, `MEMORY.md` dizini, `.claude/skills`, `docs/ozellik-durumu.md`) kaynakla aynı commit'e girer (pre-commit kancası sahneler).
