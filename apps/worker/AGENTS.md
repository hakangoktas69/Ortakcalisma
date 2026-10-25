<!-- senkron:uretildi — elle düzenlemeyin; kaynak ve üretici: node tools/ajan/senkron.mjs --yaz -->
# apps/worker — arka plan işçisi (Node) — kodlama ajanı talimatları

Bu dizinde çalışırken önce bu dizindeki `CLAUDE.md`'yi oku; kurallar oradadır ve senin için de bağlayıcıdır. Kök talimatlar: [../../AGENTS.md](../../AGENTS.md).

`CLAUDE.md` içeriği:

- İşçi bir **bileşim köküdür**: bağlamları yalnız public API'leriyle (`@eworks/<ctx>`) birleştirir, her iş ilgili bağlamın **application** katmanını çağırır; alan kuralı burada yazılmaz ([DDD rehberi §4.3](../../docs/gelistirici-rehberi/ddd.md#43-bileşim-kökü)).
- Python ACL (`services/integration`) ham kurum verisini `contracts/` diline çevirir; işçi sonucu **şemayla doğrular** (Ajv) ve uyuşmazlıkta uygulamaz (fail-closed), sonra bağlam use-case'lerine dağıtır.
- Kuruma giden her istek merkezi hız sınırlayıcıdan geçer (Redis GCRA); zamanlanmış iş kuruma **yazma** yapmaz.
- İş başlarken `requested_by` için kurum hesabı kullanım hakkı yeniden doğrulanır (05 §3.4).
- Testler: `test/*.test.ts` (in-memory portlarla birim), yığın davranışı bağlamların `*.int.test.ts`'lerinde.
