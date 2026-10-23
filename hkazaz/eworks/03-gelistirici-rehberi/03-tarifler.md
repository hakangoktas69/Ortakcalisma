# 3.3 Tarifler (senior)

> Önce: [Kod haritası](02-kod-haritasi.md) · İlgili: [Tuzaklar](05-tuzaklar.md), [Güvenlik mimarisi](../02-mimari/04-guvenlik-mimarisi.md)

Her tarifin sonunda **kontrol listesi** vardır; maddelerden biri karşılanmıyorsa değişiklik tamam değildir.

## T1 — GİB ekranı değişti, navigasyon kırıldı

1. Hatanın `jobs/<id>/status.json` ve tanılama dosyasındaki adımını bulun (menü bulunamadı / tablo başlığı uyuşmadı / sayım uyuşmadı).
2. İlgili adaptörü değiştirin: menü → `navigation_adapter.py`, kurum menüleri → `institution_discovery.py`, liste alanları → `declaration_adapter.py`, PDF kontrolleri → `declaration_document_adapter.py`, MUHSGK → `muhsgk_sgk_adapter.py`.
3. Metin eşleşmelerini Türkçe büyük/küçük harf ve boşluk varyantlarına dayanıklı yazın (`re.I`, `\s+`); karusel kopyaları gibi görünmeyen öğeleri `is_visible()` ile eleyin.
4. Yeni varyant için sentetik HTML fikstürüyle test ekleyin (`test_navigation.py`, `test_institution_discovery.py` örüntüsü).
5. Canlı doğrulama yalnızca hesap sahibinin izniyle; sonucu `GIB-Canli-Akis.md`'ye tarih + sayılarla yazın.

Kontrol: ☐ fail-closed korunuyor (belirsizlikte kayıt yok) ☐ GİB host allowlist dışına çıkılmıyor ☐ test eklendi ☐ belge güncellendi.

## T2 — Payload'a yeni alan eklemek

1. `eworks-tasarim.html` içinde varsayılan durum nesnesine alanı ekleyin (~1344: `firms:[], tasks:[], …`) ve yüklemede eksikse varsayılanla doldurun (eski kayıtlarla uyum).
2. Alan robot tarafından okunacaksa robotun okuduğu yeri de güncelleyin (ör. `declaration_documents.py:17-26`).
3. Boyutu düşünün: tüm belge ≤5 MB (`eworks_commit`). Büyük/çok satırlı veriyi payload'a koymayın; Storage veya ayrı tablo tercih edin.
4. `eworks_commit` yalnızca `firms` ve `tasks` dizilerini doğrular; yeni alan için SQL tarafında doğrulama gerekiyorsa `supabase-kurulum.sql`'i güncelleyin ve tüm ortamlarda yeniden çalıştırın.

Kontrol: ☐ eski payload ile açılış test edildi ☐ kişisel veri içeriyorsa [veri modeli](../02-mimari/03-veri-modeli.md) tablosu güncellendi ☐ JSON yedeği/dışa aktarım etkilendi mi bakıldı.

## T3 — Yeni bir robot işi (köprü uç noktası) eklemek

1. `yerel-sunucu.py do_POST` içindeki izinli yol listesine ekleyin (~180). Host + Origin + token + `verify_owner` zincirini **aynen** uygulayın; gövde sınırını en küçük yeterli değerle koyun.
2. İş türünü `run_job`'a ekleyin; zaman aşımını belirleyin; JWT'yi yalnız stdin ile geçin.
3. Robot tarafında sonucu sürümlü şemayla (`eworks.<alan>.<ad>.v1`) stdout'a yazın; ara durumları `local_files` ile atomik yazın.
4. Köprüde sonucu şema düzeyinde yeniden doğrulayın (74-93 örüntüsü).
5. Portalda sonucu birleştirip `eworks_commit` ile kaydedin; kayıt başarısızsa yeniden deneme + JSON yedeği akışını kullanın.

Kontrol: ☐ `test_portal_bridge.py`'ye yetkisiz/yanlış Origin/fazla büyük gövde testleri ☐ sonuçta kişisel veri diske yazılıyorsa temizlik eklendi ☐ tek iş kuralı korunuyor.

## T4 — SQL değişikliği

1. Betiği **idempotent** yazın: `create … if not exists`, `drop policy if exists` + `create policy`, `create or replace function`.
2. SECURITY DEFINER fonksiyonlarda `set search_path = ''` ve tam nitelikli adlar (`pg_catalog.`, `public.`) kullanın; `auth.uid()` kontrolünü fonksiyonun ilk satırına koyun.
3. Yetkileri açıkça `revoke … from public, anon, authenticated` ile kapatıp yalnız gerekeni `grant` edin.
4. `eworks_security_check()` yeni tabloyu da kapsamalı mı? RLS'e dayanan her yeni tablo için evet.
5. Değişikliği hem bulut projeye hem `hkazaz/docker/mert/supabase/migrations/` yerel denemesine uygulayın (migration aracı gelene kadar).

Kontrol: ☐ iki kez çalıştırıldı, hata yok ☐ `anon` ile erişim denendi, reddedildi ☐ başka kullanıcının JWT'si ile erişim denendi, reddedildi.

## T5 — Edge Function değişikliği

1. `index.ts`'de kimliği **her zaman** `admin.auth.getUser` sonucundan alın; istemciden kullanıcı kimliği kabul etmeyin.
2. Yeni eylem tarayıcıya sır döndürüyorsa durun ve mimarla konuşun ([G-02](../04-eksikler-ve-riskler/02-guvenlik-riskleri.md#g-02)).
3. `test_edge_function.mjs`'e senaryo ekleyin (Origin'li `robot` → 403, büyük gövde → 413, geçersiz eylem → 400).
4. Dağıtım: `supabase functions deploy gib-account --no-verify-jwt`.

## T6 — Yeni kurum/belge türü (ör. e-Defter tamamlama)

1. `institution_records.py` ortak sözleşmesine uyan bir adaptör + okuyucu çifti yazın (MUHSGK çifti örnek).
2. Belge iniyorsa `declaration_documents.py` doğrulama + içerik adresli yükleme yolunu yeniden kullanın; yeni Storage yolu şeması gerekiyorsa politika regex'ini güncelleyin.
3. Kapsamı `institution_scope.py` ile salt okunur hesap kimliğine bağlayın.
4. Mükellef Takip'e taşınma ihtimalini düşünerek çıktıyı sürümlü şema ile tanımlayın.
