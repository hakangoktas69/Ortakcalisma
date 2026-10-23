<!-- senkron:uretildi — elle düzenlemeyin; kaynak ve üretici: node tools/ajan/senkron.mjs --yaz -->
# apps/worker — arka plan işçisi (Node) — kodlama ajanı talimatları

Bu dizinde çalışırken önce bu dizindeki `CLAUDE.md`'yi oku; kurallar oradadır ve senin için de bağlayıcıdır. Kök talimatlar: [../../AGENTS.md](../../AGENTS.md).

`CLAUDE.md` içeriği:

- Her iş ilgili bağlamın **application** katmanını çağırır; alan kuralı burada yazılmaz.
- Python ACL (`services/integration`) ham kurum verisini `contracts/` diline çevirir; sonucu tablolara bu işçideki use-case uygular.
- Kuruma giden her istek merkezi hız sınırlayıcıdan geçer (Redis GCRA); zamanlanmış iş kuruma **yazma** yapmaz.
- İş başlarken `requested_by` için kurum hesabı kullanım hakkı yeniden doğrulanır (05 §3.4).
