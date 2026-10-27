---
name: eworks-etebligat-kararlari
description: "e-Tebligat uyarlaması için 2026-10-27'de alınan kararlar (D45 notices bağlamı, D46 mükellef onayı beyanı) ve etkileri — firma hesabıyla iş onaysız açılmaz, belge açılmaz, okuma tarihi boşsa tebliğ edilmedi sayılmaz"
metadata:
  node_type: memory
  type: project
  originSessionId: 3719f164-baca-47e4-9bb8-78aa7f40aca0
  modified: 2026-10-27T07:51:39.995Z
---

2026-10-27'de Hakan "önerilen kararları al, beni bekleme" diyerek ajana bıraktı; ajan önerilen seçenekleri aldı (Mert'in 26.10 e-Tebligat pilotunun yeni yapıya uyarlanması, 5. dilim).

**Kararlar**

1. **D45 / K-52 — `notices` (Tebligat) bağlamı:** e-Tebligat yeni bounded context'tir (açık konu 3'ten e-Tebligat düştü). Bugün GİB Dijital VD e-Tebligat listesi; ileride UETS (PTT) aynı bağlama girer. Tablo `notices.notices` (ofis shard'ı), yetki anahtarları `tebligat.liste.view` ve `tebligat.liste.sync` (`live: true`, D33 canlı kayıt bekler).
2. **D46 / K-53 — mükellef onayı (`CredentialConsent`) beyanla kaydedilir:** D18 gereği müşavir mükellefin kurum hesabını onaysız kullanamaz. Onay, müşavirin (ya da ofis yöneticisinin) mükelleften aldığı **yazılı onayı beyan etmesiyle** kaydedilir: onay tarihi + yöntem (sözleşme, dilekçe, e-posta), kim kaydetti; denetim kaydına yazılır, geri alınabilir (`firmalar.kurum_hesaplari.consent`). Firma hesabıyla çalışan her iş (bugün yalnız e-Tebligat) onay yoksa açılmaz; işçi/ACL iş başlarken yeniden denetler (veritabanı fonksiyonu). Mükellef kullanıcısı ekranı gelince mükellef onayı kendisi verebilir/geri alabilir; satış sözleşmesiyle onay (D27) gelince aynı kayda bağlanır.
3. **e-Tebligat okuma sınırı:** yalnız liste bilgisi (belge no, belge türü, gönderen kurum/alt birim, gönderim, tebliğ ve mükellef okuma tarihi) okunur; **belge açılmaz, okundu işaretlenmez** (belgeyi açmak tebliğ sonucu doğurabilir). Sayfalama Mert'in canlıda gözlediği uçla (`/apigateway/etebligat/etebligat/tebligat-listele`, `pageDetail.total`, `pageNo`), fail-closed: toplam, sayfa sayısı, tekil `tebligId`, tarih biçimi tutmazsa hiçbir kayıt uygulanmaz.
4. **Okuma tarihi boşsa** arayüz "okuma tarihi yok" der; **"tebliğ edilmedi" demez** (hukuki yorum yapılmaz). Liste "gözlenen liste süzgeci" kapsamındadır; arşiv/diğer kutular tamamlandı sayılmaz.

**Etkiler**

- Firma GİB hesabıyla iş için önce mükellef onayı kaydı gerekir; onay geri alınırsa süren/kuyruktaki iş başlamaz. Mevcut sözleşme/beyanname işleri müşavir hesabıyla çalıştığı için etkilenmez.
- Onay bir beyandır: Eworks onay belgesini doğrulamaz; yanlış beyanın sorumluluğu beyan edene aittir (denetim kaydında kim/ne zaman). KVKK açısından açık rıza yerine sözleşmeye dayalı işleme varsayımı — hukuki teyit açık konudur.
- Tebligat bilgisi şahıs firmasında kişisel veri sayılabilir: firma kapsamı RLS, loglara içerik girmez, CSV yok (bu dilimde).
- Canlı doğrulama (D33) kaydı girilmeden `tebligat.liste.sync` kırmızı kalır.

**Why:** Kullanıcı kararları ajana bıraktı ve bunların hafızada kalmasını özellikle istedi; kural 3/D18 onaysız firma hesabı kullanımını yasaklıyor, e-Tebligat'ta belge açmanın hukuki sonucu var.
**How to apply:** e-Tebligat, UETS ya da firma hesabıyla çalışan yeni iş türü yazarken bu kararları uygula; onay kaydı olmadan firma hesabını kullanan kod yazma. Bu kayıtlar [[eworks-hedef-mimari]] (D45–D46) ve [[eworks-acik-konular]] ile birlikte okunur.
