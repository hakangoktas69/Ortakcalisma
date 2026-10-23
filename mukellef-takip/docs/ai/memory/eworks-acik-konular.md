---
name: eworks-acik-konular
description: "[mert/eworks] Eworks hedef mimarisinde 2026-10-24 itibarıyla açık konular: 60/dk hız ile 500 ofis ölçeği uyumsuzluğu, Mükellef Takip'in eski/ sonrası durumu, depo taşıma tarihi, shard donanımı"
metadata:
  type: project
---

Klasör: mert/eworks

2026-10-24 itibarıyla Eworks hedef mimarisinde açık konular:

1. **Hız ve ölçek tutarlılığı:** 500 ofis × 1.505 ≈ 752.500 kurum hesabı var. Gece penceresi 20:00–09:00. Hepsini bir gecede taramak için web serviste ≈ 3.216 istek/dk gerekir. 60 istek/dk toplam başlangıç hızıyla tam tarama ≈ 54 gece sürer, robotla ≈ 536 gece (`05-hedef-mimari/03-kaynak-verimliligi-ve-kapasite.md` §1a). Netleşmesi gerekenler:
   - "60 istek/dk ile başla" ve "hesap başına 60 istek/dk" ifadelerinin kapsamı (toplam mı, kurum mu, servis mi robot mu, hesap mı?);
   - web servis analizinden çıkacak kurum limitleri.
2. **Mükellef Takip'in durumu:** `eski/` altına taşındıktan sonra geliştirmesi sürecek mi, arşiv mi olacak? CI buna göre ayarlanacak (`08-depo-yeniden-yapilanmasi.md` §5).
3. **Depo taşıma tarihi ve ekip duyurusu:** Tüm klasörler `eski/` altına gidecek (D28). Plan hazır, uygulama Hakan'ın onayıyla ayrı adımda yapılacak.
4. **Shard başlangıç donanımı:** Öneri: kontrol düzlemi + 2 fiziksel shard sunucusu, 16 mantıksal shard (`07-veri-saklama-ve-sharding.md` §2.3).

Süren iş: GİB/SGK web servis envanteri ve kurum erişim bilgileri Hakan tarafından analiz ediliyor (2026-10-24). Sonuç gelince 5.2 §1a'daki `integrations` tablosu ve 5.3 §1a hesapları güncellenir.

Kapananlar (2026-10-24), kararlar `hkazaz/eworks/05-hedef-mimari/01-cok-kiracili-hedef-mimari.md` D23–D30 ve karar kaydında K-31…K-37:
- web servis envanteri ve kurum izni (analiz sürüyor);
- mükellef onay biçimi (satış sözleşmesi);
- devirde veri saklama (10 yıl; itiraz süresi parametre, vars. 7 gün) ve sharding;
- hız (60/dk) ve ölçek (500 ofis, gece 20:00–09:00);
- kaynak gerçeği (`mert/eworks` revize edilen proje, veri taşıma yok);
- Claude bağlamının ve yeni kodun yeri (depo kökü, eskiler `eski/`);
- geçiş planı (doğrudan yeni sistem);
- kırmızı özellikler herkese görünür.

**Why:** Bu konular kapanmadan kapasite planı, CI ve depo taşıması kesinleşemez; kullanıcı açık konuların hafızada durmasını istedi (2026-10-24).
**How to apply:** Eworks işine başlarken bu listeye bak. Konu kapanınca: `K-NN` kaydı + ilgili `05-hedef-mimari` belgesi + `hkazaz/eworks/ai/durum-ve-riskler.md` güncellenir, madde buradan silinir. Depo taşıması yapıldığında bu kayıt yeni ekip hafızası dizinine (`docs/ai/memory/`) taşınır. Kararların özeti: [[eworks-hedef-mimari]].
