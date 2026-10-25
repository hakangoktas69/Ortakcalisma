> **Arşiv (24.10.2026, D28).** Bu belge depo yeniden yapılanmasından önceki Eworks pilotunu anlatır. İçindeki yollar taşıma öncesine göredir: `mert/eworks/…` → `eski/mert/eworks/…`, `E1/` → `eski/mert/eworks/entegrasyon-1-tarayici/`, `hkazaz/…` → `eski/hkazaz/…`, `mukellef-takip/…` → `eski/hakan/mukellef-takip/…`, `05-hedef-mimari/` → [docs/hedef-mimari/](../../hedef-mimari/01-cok-kiracili-hedef-mimari.md). Yeni yapının bağlamı: kök `CLAUDE.md` ve `docs/ai/`.

# Eworks — kodlama ajanı talimatları (Codex vb.)

Bu bağlam Claude Code için yazılmıştır ama araçtan bağımsızdır; aynısına uy. Kurallar burada **tekrarlanmaz**; kaynak aşağıdaki dosyalardır. Çelişki olursa kaynak dosya geçerlidir.

## Oturum başında

1. Depo kökündeki `CLAUDE.md` ve `AGENTS.md`'yi oku (klasör sahipliği: `mert/eworks` Mert'indir; değiştirmeden önce kullanıcıya sor).
2. `hkazaz/eworks/CLAUDE.md`'yi oku; içindeki `@ai/x.md` satırları içe aktarımdır: `ai/baglam.md`, `ai/kurallar.md`, `ai/durum-ve-riskler.md`'yi de oku.
3. İşin türüne göre: yeni robot işi / SQL / Edge → `03-gelistirici-rehberi/03-tarifler.md`; hata ayıklama → `03-gelistirici-rehberi/05-tuzaklar.md`.
4. Ekip hafızasında Eworks kayıtları: `mukellef-takip/docs/ai/memory/MEMORY.md` içinde `eworks-` ile başlayanlar.

`CLAUDE.md`'deki "Pazarlıksız kurallar" ve `ai/kurallar.md` senin için de bağlayıcıdır.

## Bilgi nereye yazılır

Kural → `ai/kurallar.md` · durum/risk → `ai/durum-ve-riskler.md` + `04-eksikler-ve-riskler/` · mimari karar → `02-mimari/05-mimari-kararlar.md` · tuzak → `03-gelistirici-rehberi/05-tuzaklar.md` · öğrenilmiş ve kodda/belgede görünmeyen bilgi → `mukellef-takip/docs/ai/memory/eworks-<ad>.md` (biçim: `mukellef-takip/AGENTS.md` "Ekip hafızasına yazarken"; gövdenin ilk satırı `Klasör: mert/eworks`) · kişisel veri/sır → hiçbir yer.

## İşi bitirmeden önce

- `mert/eworks` altında kod değiştiyse: `VALIDATION.md` test kümesini ve `node test_edge_function.mjs`'i koş; kırmızı bırakma, koşulamayanı kullanıcıya söyle.
- Davranış değiştiyse aynı değişiklikte kullanıcı belgesini (`E1/Eworks-Portal/*.md`) ve `hkazaz/eworks` ilgili sayfasını, risk tablolarındaki **Durum** sütununu güncelle.
- Hafızaya yazdıysan `cd mukellef-takip && npm run memory:check`.
