---
name: hafiza
description: Ekip hafızasına (docs/ai/memory) kayıt ekler veya günceller, kişisel Claude hafızasındaki proje kayıtlarını ekip hafızasına aktarır, hafızayı denetler. "Bunu hatırla", "hafızaya yaz", "ekip bilsin", "/hafiza aktar", "/hafiza denetle" dendiğinde kullan.
---

<!-- senkron:uretildi — elle düzenlemeyin; kaynak ve üretici: node tools/ajan/senkron.mjs --yaz; kaynak docs/ai/beceriler/hafiza.md -->
# Ekip hafızası

Ekip hafızası `docs/ai/memory/` dizinidir ve git ile sürümlenir. Depoyu çeken herkesin Claude'u ve Codex'i bunu okur (Codex `AGENTS.md`'deki kopyadan). Burada yazdığın her şey **paylaşılır**.

Argümana göre: boş ya da serbest metin → **kaydet**; `aktar` → **aktar**; `denetle` → **denetle**.

## Kaydet

1. **Nereye ait?** Şu sıraya bak, uyan ilk yere yaz. Hafıza son seçenektir:
   - Koddan veya git geçmişinden okunabiliyorsa hiçbir yere yazma.
   - Her oturumda uyulacak kural → ilgili `docs/ai/*.md` veya `CLAUDE.md`.
   - Karar → `docs/adr/karar-kaydi.md` (`K-NN`) + `docs/hedef-mimari/01` (`D-NN`) + `docs/ai/durum.md` + ekip hafızası `eworks-hedef-mimari` (dördü birlikte, `docs/ai/kurallar.md`).
   - Bir bağlamın kuralı, ucu veya olayı → `docs/baglamlar/<context>.md`.
   - Açık konu → ekip hafızası `eworks-acik-konular` + `docs/ai/durum.md`.
   - Kişiye özel tercih ("bana kısa yanıt ver") → `CLAUDE.local.md` (gitignore'da). Ekip hafızasına yazma.
   - Bunların hiçbiri değilse ve öğrenilmiş bilgiyse **ekip hafızası**: kullanıcının düzeltmesi ve gerekçesi, kodda görünmeyen proje kısıtı, dış kaynak bağlantısı.
2. Mevcut kayıtlara bak (`docs/ai/memory/MEMORY.md`). Aynı konuda kayıt varsa **onu güncelle**, yenisini açma. Yanlışlanan kaydı sil.
3. Dosya: `docs/ai/memory/<kebab-ad>.md`. Ad Türkçe ve ASCII olsun (`gib-servis-limitleri.md`). Biçim:
   ```markdown
   ---
   name: <kebab-ad, dosya adıyla aynı>
   description: <tek satır; ne zaman işe yarar>
   metadata:
     type: feedback | project | reference
   ---

   <bilgi>

   **Why:** <neden>          (feedback/project için)
   **How to apply:** <ne zaman, nasıl>
   ```
   Göreli tarihleri mutlak yaz ("dün" yerine 2026-10-23). İlgili kayıtlara veya belgelere `[[dosya-adı]]` ile bağlan (Obsidian bağlantısı; uzantı yazılmaz). Kayıt `eski/` altındaki bir projeye aitse gövdenin ilk satırı `Klasör: eski/<klasör>` olur.
4. `MEMORY.md`'ye tek satır ekle: `- [Başlık](dosya.md) — kısa kanca`. İçeriği oraya yazma. (Unutursan `senkron --yaz` description'dan ekler.)
5. **Asla yazma:** VKN/TCKN, ad soyad + kimlik, IBAN, telefon, e-posta, gerçek mükellef/müşavir/ofis adı, kurum şifresi, token, `.env` değeri, Supabase URL/anahtarı. Örnek gerekiyorsa `@eworks/testing` sahte üreticisini veya `@eworks.test` alan adını kullan.
6. `node tools/claude/check-memory.mjs` çalıştır; hata varsa düzelt. Sonra `node tools/ajan/senkron.mjs --yaz` (Codex'in `AGENTS.md`'si güncellenir; pre-commit kancası da yapar).
7. Kullanıcıya ne yazdığını ve bunun commit/PR ile ekibe gideceğini söyle.

## Aktar

Kişisel hafıza `~/.claude/projects/<proje-yolu>/memory/` altındadır. SessionStart kancası yolu bağlama yazar.

1. Oradaki her `*.md` kaydını oku (`MEMORY.md` hariç).
2. Her kaydı sınıflandır ve kullanıcıya tablo olarak göster:
   - **ekibe** (projeyle ilgili `feedback`/`project`/`reference`)
   - **kişisel kalsın** (`user` türü, kişiye özel tercih)
   - **gereksiz** (koddan okunabilen, eskimiş ya da yanlış)
3. Onay al. "Ekibe" olanları *Kaydet* adımlarıyla `docs/ai/memory`'ye taşı: Türkçeleştir, oturum alanlarını (`originSessionId` vb.) at, yinelenenleri birleştir.
4. Taşınanları kişisel hafızadan yalnız kullanıcı onayladıysa sil ve kişisel `MEMORY.md`'yi güncelle.
5. `node tools/claude/check-memory.mjs`.

## Denetle

1. `node tools/claude/check-memory.mjs` ve `node tools/ajan/senkron.mjs --denetle`.
2. Her kaydı kodla ve `docs/ai/durum.md` ile karşılaştır. Dosya, işlev veya bayrak adı geçiyorsa hâlâ var mı bak. Eskimiş kaydı güncellemeyi ya da silmeyi öner.
3. Birbirini tekrarlayan kayıtları birleştirmeyi, `docs/ai`'ye taşınması gereken kalıcı kuralları taşımayı öner.
