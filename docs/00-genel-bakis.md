# Genel bakış

Eworks, mali müşavir ofislerinin kurum (GİB, SGK) verilerini müşavirin ve mükelleflerin kendi hesaplarıyla toplu çektiği çok kiracılı SaaS portaldır. Bu sayfa yeni geliştiricinin okuma sırasını ve belge haritasını verir.

## Okuma sırası

1. [README](../README.md) — bağlam haritası, dizin haritası, istek akışı, çalıştırma, özellik durumu özeti
2. Bu sayfa
3. [ai/vizyon.md](ai/vizyon.md), [ai/mimari.md](ai/mimari.md), [ai/kurallar.md](ai/kurallar.md), [ai/test.md](ai/test.md) — kısa bağlam (Claude/Codex de bunları okur)
4. [ai/durum.md](ai/durum.md) — şu anki durum ve açık konular
5. Çalışacağın bağlamın sayfası: [baglamlar/](baglamlar/README.md), sonra `packages/contexts/<ctx>/src/index.ts`

## Belge haritası

| Klasör | İçerik |
|---|---|
| [hedef-mimari/](hedef-mimari/01-cok-kiracili-hedef-mimari.md) | Kararlar D1–D35 ve gerekçeli ayrıntı: 01 genel, 02 kurum entegrasyonu, 03 kapasite, 04 dağıtım, 05 yetki ve hesap, 06 kaynak kod DDD/TDD, 07 veri saklama ve sharding, 08 depo yeniden yapılanması, 09 ajan bağlamı |
| [adr/](adr/README.md) | Karar kaydı (`K-NN`) ve uzun ADR'ler |
| [baglamlar/](baglamlar/README.md) | Bounded context sayfaları |
| [ozellik-durumu.md](ozellik-durumu.md) | Modül → sayfa → işlem, kırmızı/yeşil (üretilir) |
| [ai/](ai/vizyon.md) | Ajan bağlamı; [ai/memory/](ai/memory/MEMORY.md) ekip hafızası; `ai/beceriler/` beceri kaynakları |
| [gelistirici-rehberi/](gelistirici-rehberi/claude-codex.md) | Claude Code ve Codex ile çalışma, ekip senkronu; [canlı GİB doğrulaması](gelistirici-rehberi/canli-dogrulama.md) |
| [arsiv/mevcut-durum/](arsiv/mevcut-durum/README.md) | Eski Eworks pilotunun analizi (yalnız referans) |
