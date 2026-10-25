---
name: paralel-oturumlar
description: "Aynı çalışma ağacında birden çok Claude/Codex oturumu paralel çalışabilir — başkasının değişikliğini geri alma, commit'leri oturum/iş başına ayır, karışık dosyayı satır bazında böl"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c78b2446-d214-4b79-be47-5bbe8922bce1
  modified: 2026-10-25T21:26:51.432Z
---

Bu depoda aynı makinede, **aynı çalışma ağacında** birden çok ajan oturumu aynı anda çalışabiliyor (2026-10-25: bir oturum DDD/TDD belgelerini yazarken diğeri `eski/mukellef-takip` → `eski/hakan/mukellef-takip` taşımasını yaptı; ikisi dört ortak dosyaya farklı satırlar yazdı ve biri diğerinin dosyalarını arada sahneledi). Hakan iki işin **ayrı commit'lere** alınmasını istedi.

- `git status`'ta kendi yapmadığın değişiklik, silinmiş görünen klasör ya da index'te beklenmedik sahneleme görürsen **geri alma, düzeltme**: önce `ListAgents` ile eş oturumlara bak, değişikliğin hangi işe ait olduğunu belirle, kullanıcıya söyle.
- Commit öncesi her dosyanın hunk'larını sahibine göre ayır. Aynı dosyada iki işin satırları varsa `HEAD` + yalnız kendi satırlarını kurup `git hash-object -w` + `git update-index --cacheinfo` ile sahnele (etkileşimli `git add -p` kullanılamıyor). Sonra `git diff --cached`'da öteki işin izi (ör. yeni yol) kalmadığını grep'le doğrula.
- Index'te başkasının sahnelemesi varsa içerikleri değil yalnız sahnelemeyi kaldır (`git restore --staged --pathspec-from-file`); çalışma ağacına dokunma.
- Kullanıcı istemedikçe başka oturumun işini commitleme. İsterse ayrı commit'e al, mesajda değişikliklerden çıkardığını belirt ve o oturuma bildirilmesini öner (kendi commit'ini atmaya çalışmasın).
- Pre-commit kancası `senkron --yaz` ile üretilen dosyaları çalışma ağacından sahneler: commit'ten önce `AGENTS.md`/`MEMORY.md` farkında öteki işin izi var mı bak.

**Why:** İki oturumun işi tek commit'e karışırsa geri alma ve inceleme zorlaşır; "silinmiş" sanılan dosyayı geri getirmek öteki oturumun işini bozar.
**How to apply:** Commit ya da toplu `git add` öncesi her seferinde uygula. Çalışma biçimi: [[eworks-calisma-bicimi]]; ajan senkronu: [[ajan-senkron-betikleri]].
