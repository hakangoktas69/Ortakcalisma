# Eworks — Claude proje belleği

Mali müşavir ofislerinin GİB e-Beyanname, SGK (e-Bildirge, işe giriş/çıkış, e-Rapor, iş kazası) ve diğer kurum verilerini **kurum web servisleri (birincil) ve sunucu tarafı robot (yedek)** ile toplu çektiği, **çok kiracılı SaaS** portal. Kiracı = ofis; ofis → müşavir → mükellef; müşavirin ve her mükellefin kendi kurum hesapları vardır. Kurum şifreleri (Vault), VKN/TCKN ve sağlık verisi (e-Rapor) işlendiği için **KVKK ve kurum kuralları** temel tasarım kısıtıdır.

Bu depo 24.10.2026'da yeniden yapılandı (D28): yeni yapı **kökte**, eski tüm klasörler `eski/` altında **arşivdir** ([eski/README.md](eski/README.md)). `eski/` altındaki `CLAUDE.md`'ler eski projelerin bağlamıdır; yeni kod için geçerli değildir.

Bu dosya ve içe aktarılan belgeler ekibin ortak bağlamıdır; git'e girer. Kural, mimari, durum veya karar değiştiğinde **aynı değişiklikte** ilgili `docs/ai/*.md`, karar kaydı ve gerekirse `docs/hedef-mimari` güncellenir.

## Ayrıntılı bağlam

- @docs/ai/vizyon.md — ürün, kullanıcılar, kapsam, ilkeler
- @docs/ai/mimari.md — bileşenler, bounded context'ler, katmanlar, veri ve sharding
- @docs/ai/kurallar.md — pazarlıksız kurallar, kod üslubu, kararların işlenme biçimi
- @docs/ai/test.md — TDD akışı, test katmanları, özellik durumu (kırmızı/yeşil)
- @docs/ai/durum.md — şu anki durum, açık konular, sıradaki işler (işe başlamadan bak)
- Hedef mimari (gerekçeler, ayrıntı): `docs/hedef-mimari/01…09`; karar kaydı `docs/adr/karar-kaydi.md` (`K-NN`), kısa liste `D-NN` hedef-mimari/01'de.
- **Kod değiştirmeden önce** (özellik, uç, ekran, kural, migration, hata düzeltme, refactor): `gelistir` becerisini uygula (`docs/ai/beceriler/gelistir.md`): **A)** önce hafıza, yapı ve iş modelini özümse; **B)** etki, hata ve güvenlik analiziyle planla, DDD + TDD ile uygula; **C)** tutarlılık, fonksiyonel ve dört ekran görsel/UX doğrulaması. Kavram ve örnekler: [DDD rehberi](docs/gelistirici-rehberi/ddd.md), [TDD rehberi](docs/gelistirici-rehberi/tdd.md).
- Bağlam sayfası: bir bağlamda çalışmadan önce `docs/baglamlar/<context>.md`. Alt dizin kuralları: `apps/*`, `packages/contexts`, `packages/kernel`, `packages/feature-registry`, `services/integration`, `supabase` altındaki `CLAUDE.md`.
- Eski Eworks pilotunun analizi (yalnız referans): `docs/arsiv/mevcut-durum/`.

## Kiminle çalışıyorsun

Ajana iş veren geliştiriciler **junior**dır ve yazılım geliştirmeyi bilmeyebilir. Teknik doğruluk, güvenlik ve test sorumluluğu ajandadır:

- İsteği iş diliyle yeniden anlat ve onay al; belirsizliği tahminle değil, seçenekli kısa sorularla kapat; teknik terimi ilk kullanışta açıkla.
- Kural çiğneyen isteği yapma; nedenini sade anlat, meşru yolu öner. "Hızlıca", "testi sonra" gibi istekler kuralları ve doğrulamayı askıya almaz.
- Öncelik: **güvenlik ve sağlamlık → doğruluk → performans**.
- Raporda neyin doğrulandığını, neyin **doğrulanamadığını** ve kullanıcının elle bakabileceği yeri ayrı yaz.

## Ekip hafızası ve ajanlar

Otomatik hafıza dizini `docs/ai/memory/`'dir; git'e girer, ekipçe paylaşılır. Yönlendirmeyi SessionStart kancası (`tools/claude/session-start.mjs`) yapar. Claude ↔ Codex senkronu tek kaynaktan üretimle çalışır ([hedef-mimari/09](docs/hedef-mimari/09-yapay-zeka-ajan-baglami.md), rehber `docs/gelistirici-rehberi/claude-codex.md`).

- **Oturum başında:** bağlamda ekip hafızasının `MEMORY.md` içeriği yoksa önce `docs/ai/memory/MEMORY.md`'yi oku; kancanın çalışmadığını kullanıcıya bir kez söyle. SessionStart çıktısında ekipten gelen değişiklik varsa önce ona uy.
- Doğru katman: kalıcı kural → `docs/ai/*.md`; karar → `docs/adr/karar-kaydi.md` (+ hedef-mimari/01 `D-NN`); bağlam bilgisi → `docs/baglamlar/`. Hafızaya yalnız öğrenilmiş ve kodda/belgede görünmeyen bilgi (`feedback`, `project`, `reference`) yazılır.
- **Kişiye özel tercih ekip hafızasına yazılmaz** → `CLAUDE.local.md` (gitignore'da). Kişisel veri, sır, gerçek mükellef/müşavir bilgisi hiçbir yere yazılmaz. Yazdıktan sonra `node tools/claude/check-memory.mjs`.
- `AGENTS.md`, `MEMORY.md` dizini ve `.claude/skills/` **üretilir** (`node tools/ajan/senkron.mjs --yaz`; git kancaları da çalıştırır). Kural `AGENTS.md`'ye değil bu dosyaya veya `docs/ai`'ye yazılır. Beceri kaynakları `docs/ai/beceriler/`.
- Stop kancası kodda commitlenmemiş değişiklik varken `node tools/ajan/bitir.mjs --ajan claude` adımlarına yönlendirir; iş bitince bu adımları atlama.

## Yapı

```
packages/kernel               paylaşılan çekirdek: TaxId (VKN/TCKN), Period, Result, DomainEvent, Clock
packages/contexts/<context>   bounded context: src/{domain,application,infrastructure}, src/index.ts (PUBLIC API), test/
packages/feature-registry     özellik ağacı = yetki ağacı = TDD durum kaynağı (hepsi kırmızı başlar)
packages/platform · testing   teknik altyapı · test yardımcıları (sahte VKN/TCKN)
apps/web · apps/sales · apps/worker   Next.js portal + BFF · satış portalı · arka plan işçisi   → apps/*/CLAUDE.md
services/integration          Python ACL: kurum web servisi / robot → contracts/ (yayımlanmış dil)
contracts/ · supabase/ · deploy/      şemalar · migrations (control / tenant) + pgTAP · Compose / K8s
tools/                        arch (katman kuralları), features (özellik durumu), ajan (senkron), claude (kancalar), git-hooks, docs
docs/                         ai/ (bağlam + memory/), hedef-mimari/, baglamlar/, adr/, arsiv/, ozellik-durumu.md (üretilir)
eski/                         yeniden yapılanma öncesi depo — arşiv, yeni geliştirme yok
```

## Çalıştırma

Node 24 ve pnpm (corepack) gerekir; yerel Node eskiyse komutları `node:24` container'ında koş (`sh tools/deploy/dogrula.sh` = `pnpm verify` container'da).

```bash
node tools/deploy/yigin.mjs up     # Compose yığını: sırlar (deploy/compose/.env), imajlar, altyapı → migrate → uygulama
node tools/deploy/yigin.mjs test   # birim + entegrasyon (gerçek Postgres/Redis/RabbitMQ/S3/GoTrue) + pgTAP, yığının ağında
node tools/deploy/yigin.mjs e2e    # arayüz kabul testleri (Playwright, 4 ekran) yığına karşı
corepack enable && pnpm install    # prepare: git kancalarını kurar (core.hooksPath = tools/git-hooks)
pnpm verify                        # tip, mimari kurallar, birim testleri + kapsam eşiği, yetki anahtarı denetimi, hafıza, ajan senkronu, belge bağlantıları
pnpm test                          # birim testleri (bağımlılıksız); pnpm test:kapsam = kapsam eşiğiyle
pnpm arch                          # dependency-cruiser katman/bağlam kuralları
pnpm features                      # test sonuçlarından docs/ozellik-durumu.md + README özeti
node --test "tools/ajan/test/*.test.mjs"       # ajan senkronu kabul testleri
```

## Pazarlıksız kurallar (özet; ayrıntı ve gerekçe `docs/ai/kurallar.md`)

1. **Kiracı izolasyonu:** her kiracı tablosunda `org_id`, PK `(org_id, id)` ile başlar, RLS'siz tablo yok; başka ofisin kaydı 404. Mükellef yalnız kendi firmasını görür.
2. **Kurum şifresi yalnız Vault'ta;** tarayıcıya, loga, diske, hataya gitmez; her okuma denetim kaydına yazılır. **Mükellef müşavirin kurum bilgilerini asla kullanamaz** (DB + BFF + işçi).
3. **Tarayıcı JS'inde token, Supabase adresi/anahtarı, arka uç adresi yok** (D5); `NEXT_PUBLIC_*` yasak.
4. **Kuruma giden her istek merkezi hız sınırlayıcıdan geçer;** hesap başına sahte/dönüşümlü IP yok (D14, K-22). Kurum denetimini atlatmaya yönelik istek tasarıma alınmaz.
5. **DDD sınırları:** bağlamlar birbirine yalnız `src/index.ts` ve olaylarla erişir; `domain` saf kalır; Python yalnız ACL'dir. `pnpm arch` yeşil olmalı.
6. **TDD:** yeni özellik önce `feature-registry`'ye, sonra `@F:<anahtar>` etiketli kırmızı kabul testi; testsiz kod yok, kapsam eşiği (domain + application %90 satır / %80 dal) düşürülmez; `pnpm verify` ve CI zorlar.
7. **Her sayfa/uç/server action tek bir yetki anahtarı bildirir** (`apps/web/src/bff/yetki-anahtarlari.test.ts` denetler); yetki yükseltme yasak, karar BFF'te ve RLS'te.
8. **Kişisel veri** (VKN/TCKN, ad, SGK çalışan bilgisi, sağlık) log'a, hata mesajına, fikstüre, belgeye, hafızaya girmez; sahte üretici `@eworks/testing`.
9. **Sırlar** (`.env`, anahtar, Supabase URL) commit edilmez; yalnız `.env.example`.
10. `eski/` altında yeni geliştirme yapılmaz; oradan kod alınırsa yeni yapıya testleriyle taşınır.

## Dil ve üslup

Arayüz metinleri, yorumlar, belgeler, commit mesajları **Türkçe**; tanımlayıcılar İngilizce (sözlük: `docs/ai/mimari.md`). Doğrulanmamış kurum davranışını doğrulanmış gibi yazma. Mermaid diyagramları çizilerek doğrulanır.
