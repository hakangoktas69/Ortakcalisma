---
name: oryantasyon
description: Projeye yeni katılan geliştiriciyi karşılar — rolüne göre okuma yolu, güncel durum, ortam kontrolü ve ilk işi önerir. "Projeye yeni katıldım", "nereden başlamalıyım", "projeyi anlat", "/oryantasyon" dendiğinde kullan.
---

<!-- senkron:uretildi — elle düzenlemeyin; kaynak ve üretici: node tools/ajan/senkron.mjs --yaz; kaynak docs/ai/beceriler/oryantasyon.md -->
# Oryantasyon

Amaç, geliştiricinin projeyi sıfırdan keşfetmesine gerek bırakmamak. Bilgi zaten `README.md`, `CLAUDE.md`, `docs/ai/`, `docs/ai/memory/` ve `docs/` altında. Sen bunları kişiye göre süz.

1. **Durumu topla.** Kullanıcıya sormadan önce oku:
   - `docs/ai/durum.md`: durum, açık konular, sıradaki işler
   - `docs/ozellik-durumu.md`: hangi özellikler kırmızı/yeşil
   - `docs/ai/memory/MEMORY.md` ve ilgili kayıtlar
   - `git log --oneline -15`
   - `docs/00-genel-bakis.md`: okuma sırası (junior ve derinleşme) ve belge haritası
   - `docs/gelistirici-rehberi/baslangic.md`: kurulum, çalıştırma, geliştirme döngüsü, sorun giderme (junior için ilk belge)
2. **Kısa özet ver** (10–15 satır):
   - sistem ne yapar (çok kiracılı SaaS; ofis → müşavir → mükellef; web servis birincil, robot yedek)
   - ana parçalar (`packages/contexts`, `apps/web`, `apps/sales`, `apps/worker`, `services/integration`, `supabase`)
   - en önemli 5 pazarlıksız kural (kiracı izolasyonu, kurum şifresi yalnız Vault'ta + mükellef müşavir hesabını kullanamaz, tarayıcıda gizli bilgi yok, kuruma giden istek hız sınırlayıcıdan, TDD ve `@F:` etiketi)
   - hangi fazdayız; `eski/` klasörünün arşiv olduğu
3. **Sor**: rolü (junior / senior / mimar / ürün), hangi bağlamda çalışacağı, Docker ve Node 24'ün kurulu olup olmadığı.
4. **Ortamı kontrol et:**
   - `node -v`, `docker version --format '{{.Server.Version}}'`, `git config core.hooksPath` (beklenen `tools/git-hooks`)
   - Node 24 değilse komutları `node:24` container'ında koşmasını söyle; Node 20'nin corepack'i pnpm'i indiremez (`Cannot find matching keyid`, baslangic.md §12)
   - Windows'ta `git config --global core.longpaths` `true` mu
   - `node tools/claude/check-memory.mjs` ve `node tools/ajan/senkron.mjs --denetle`
   - `.claude/settings.local.json` içinde `autoMemoryDirectory` `docs/ai/memory`'yi gösteriyor mu; göstermiyorsa SessionStart kancası çalışmamıştır (kancalar açık mı, `node` PATH'te mi)
   - depo yeniden yapılanmasından önce klonlandıysa `node tools/ajan/eski-yerel-tasi.mjs` (kuru çalıştırma) çıktısına bak
5. **Okuma yolu çıkar:** `docs/00-genel-bakis.md`'deki sırayı çalışacağı bağlamın sayfasıyla (`docs/baglamlar/<context>.md`) ve ilgili `docs/hedef-mimari` belgesiyle birleştir. En fazla 6 belge, sırayla ve her birinin neden okunacağıyla.
6. **İlk iş öner:** `docs/ai/durum.md`'deki sıradaki işlerden ya da çalışacağı bağlamdaki kırmızı bir özellikten rolüne uygun, küçük ve testi net bir iş seç. TDD akışını (`docs/ai/test.md`) ve dokunacağı dosyaları söyle.
7. **Hafıza düzenini anlat** (3 satır):
   - öğrenilen ve kodda görünmeyen bilgi `/hafiza` ile ekip hafızasına yazılır ve PR'da incelenir; Codex kullananlar da aynı dizini kullanır
   - kişisel tercih `CLAUDE.local.md`'ye yazılır
   - `AGENTS.md`, `MEMORY.md` dizini ve beceriler üretilir; kural kaynağa yazılır

Yanıtları Türkçe ver. Belgede olmayan bir şeyi tahmin edip gerçekmiş gibi anlatma; bilmediğini söyle ve hangi belgenin eksik olduğunu not et.
