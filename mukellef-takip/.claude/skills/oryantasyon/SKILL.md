---
name: oryantasyon
description: Projeye yeni katılan geliştiriciyi karşılar — rolüne göre okuma yolu, güncel durum, ortam kontrolü ve ilk işi önerir. "Projeye yeni katıldım", "nereden başlamalıyım", "projeyi anlat", "/oryantasyon" dendiğinde kullan.
---

# Oryantasyon

Amaç, geliştiricinin projeyi sıfırdan keşfetmesine gerek bırakmamak. Bilgi zaten `CLAUDE.md`, `docs/ai/`, `docs/ai/memory/` ve `docs/` altında. Sen bunları kişiye göre süz.

1. **Durumu topla.** Kullanıcıya sormadan önce şunları oku:
   - `docs/ai/roadmap.md`: biten ve açık işler
   - `docs/ai/memory/MEMORY.md` ve ilgili kayıtlar
   - `git log --oneline -15`
   - `docs/README.md`: rol bazlı okuma yolları
2. **Kısa özet ver** (10-15 satır):
   - sistem ne yapar
   - ana parçalar (api / web / extension / infra)
   - en önemli 5 pazarlıksız kural (tenant izolasyonu, kurum şifresi, GİB'e otomatik giriş yok, kişisel veri log'a gitmez, testsiz değişiklik yok)
   - şu an hangi fazdayız
3. **Sor** (AskUserQuestion): rolü (junior / senior / mimar / ürün), hangi bağlamda veya parçada çalışacağı, Docker ve Node 24'ün kurulu olup olmadığı.
4. **Ortamı kontrol et:**
   - `node -v`, `docker version --format '{{.Server.Version}}'`, `git config core.hooksPath`
   - eksikleri `docs/05-gelistirici-rehberi/01-ilk-gun.md`'ye göre söyle
   - Node 24 değilse [[node-24-gerekli]] kaydını uygula
   - `npm run memory:check` çalıştır
   - `.claude/settings.local.json` içinde `autoMemoryDirectory` var mı bak. Yoksa SessionStart kancası çalışmamıştır; kancaların açık olduğunu ve `node`'un PATH'te olduğunu kontrol ettir.
5. **Okuma yolu çıkar:** `docs/README.md`'deki role uygun yolu, çalışacağı bağlamın sayfasıyla (`docs/02-baglamlar/<context>.md`) birleştir. En fazla 6 belge, sırayla ve her birinin neden okunacağıyla.
6. **İlk iş öner:** roadmap'teki açık maddelerden ve `docs/03-taktiksel-tasarim/06-taktik-borc.md`'den rolüne uygun, küçük ve testi net bir iş seç. Hangi dosyalara dokunacağını ve hangi tarifin (`docs/05-gelistirici-rehberi/02-tarifler.md`) uygulanacağını söyle.
7. **Hafıza düzenini anlat** (3 satır):
   - öğrenilen ve kodda görünmeyen bilgi `/hafiza` ile ekip hafızasına yazılır ve PR'da incelenir
   - kişisel tercih `CLAUDE.local.md`'ye yazılır
   - belgeler Obsidian'da `docs/` kasası olarak açılabilir

Yanıtları Türkçe ver. Belgede olmayan bir şeyi tahmin edip gerçekmiş gibi anlatma; bilmediğini söyle ve hangi belgenin eksik olduğunu not et.
