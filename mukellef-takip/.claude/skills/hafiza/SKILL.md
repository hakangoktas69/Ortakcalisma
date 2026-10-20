---
name: hafiza
description: Ekip hafızasına (docs/ai/memory) kayıt ekler veya günceller, kişisel Claude hafızasındaki proje kayıtlarını ekip hafızasına aktarır, hafızayı denetler. "Bunu hatırla", "hafızaya yaz", "ekip bilsin", "/hafiza aktar", "/hafiza denetle" dendiğinde kullan.
---

# Ekip hafızası

Ekip hafızası `docs/ai/memory/` dizinidir ve git ile sürümlenir. Repoyu çeken herkesin Claude'u bunu okur. Burada yazdığın her şey **paylaşılır**.

Argümana göre: boş ya da serbest metin → **kaydet**; `aktar` → **aktar**; `denetle` → **denetle**.

## Kaydet

1. **Nereye ait?** Önce şu sıraya bak, uyan ilk yere yaz. Hafıza son seçenektir:
   - Koddan veya git geçmişinden okunabiliyorsa hiçbir yere yazma.
   - Her oturumda uyulacak bir kural → ilgili `docs/ai/*.md` veya `CLAUDE.md`.
   - Gerekçeli bir mimari karar → `docs/adr/NNNN-*.md`.
   - Bir bağlamın kuralı, ucu veya olayı → `docs/02-baglamlar/<context>.md`.
   - Bir tuzak veya sık soru → `docs/05-gelistirici-rehberi/04-tuzaklar.md`.
   - Kişiye özel bir tercih ("bana kısa yanıt ver") → `CLAUDE.local.md` (gitignore'da). Ekip hafızasına yazma.
   - Bunların hiçbiri değilse ve öğrenilmiş bilgiyse **ekip hafızası**. Örnekler: kullanıcının düzeltmesi ve gerekçesi, kodda görünmeyen bir proje kısıtı, dış kaynak bağlantısı.
2. Mevcut kayıtlara bak (`docs/ai/memory/MEMORY.md`). Aynı konuda kayıt varsa **onu güncelle**, yenisini açma. Yanlışlanan kaydı sil.
3. Dosya: `docs/ai/memory/<kebab-ad>.md`. Ad Türkçe ve ASCII olsun (`gib-eklenti-oturumu.md`). Biçim:
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
   Göreli tarihleri mutlak yaz ("dün" yerine 2026-10-19). İlgili kayıtlara veya belgelere `[[dosya-adı]]` ile bağlan. Bu Obsidian bağlantısıdır; uzantı yazılmaz.
4. `MEMORY.md`'ye tek satır ekle: `- [Başlık](dosya.md) — kısa kanca`. İçeriği oraya yazma.
5. **Asla yazma:** TCKN/VKN, ad soyad + kimlik, IBAN, telefon, e-posta, gerçek mükellef veya büro adı, kurum şifresi, token, `.env` değeri. Örnek gerekiyorsa `test-tckn.ts` üreticisini veya `@mukellef.test` alan adını kullan.
6. `npm run memory:check` çalıştır; hata varsa düzelt.
7. Kullanıcıya ne yazdığını ve bunun commit/PR ile ekibe gideceğini söyle.

## Aktar

Kişisel hafıza `~/.claude/projects/<proje-yolu>/memory/` altındadır. SessionStart kancası yolu bağlama yazar.

1. Oradaki her `*.md` kaydını oku. `MEMORY.md` hariç.
2. Her kaydı sınıflandır ve kullanıcıya tablo olarak göster:
   - **ekibe** (projeyle ilgili `feedback`/`project`/`reference`)
   - **kişisel kalsın** (`user` türü, kişiye özel tercih)
   - **gereksiz** (koddan okunabilen, eskimiş ya da yanlış)
3. Onay al. Ardından "ekibe" olanları yukarıdaki *Kaydet* adımlarıyla `docs/ai/memory`'ye taşı: Türkçeleştir, `originSessionId` gibi oturum alanlarını at, yinelenenleri birleştir.
4. Taşınanları kişisel hafızadan sil ve kişisel `MEMORY.md`'yi güncelle; yalnız kullanıcı onayladıysa. "Kişisel kalsın" olanlar yerinde kalır.
5. `npm run memory:check`.

## Denetle

1. `npm run memory:check` çalıştır.
2. Her kaydı kodla ve `docs/ai/roadmap.md` ile karşılaştır. Dosya, işlev veya bayrak adı geçiyorsa hâlâ var mı bak. Eskimiş kaydı güncellemeyi ya da silmeyi öner.
3. Birbirini tekrarlayan kayıtları birleştirmeyi, `docs/ai`'ye taşınması gereken kalıcı kuralları taşımayı öner.
