<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->
[README](../../README.md) › **Kurum entegrasyonu (ACL)**
<!-- /gezinti -->

# services/integration — kurum entegrasyonu (Python ACL)

Kurumla konuşan tek katman: web servis birincil, robot yedek (D19). Çıktısı `contracts/integration/*.schema.json` biçimindedir; alan tablolarına yazmaz, sonucu `apps/worker` uygular. Yapı: [06 §3](../../docs/hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#3-depo-yapısı), kapasite ve hız: [02](../../docs/hedef-mimari/02-kurum-entegrasyon-robotu.md). Akış: [baglamlar/sync.md](../../docs/baglamlar/sync.md).

| Yer | İçerik |
|---|---|
| `src/eworks_integration/core/` | ayarlar (üretimde sahte kurum yasak), `calisan` (kuyruk tüketicisi), `hiz` (Redis GCRA, kurum başına ortak bütçe), `captcha` (ddddocr) |
| `src/eworks_integration/transports/service/` | `http_tasima.py` (D38 `servis` yolu, Eworks 2): kurum politikasının (`institutions/gib/ebeyanname_servis.py`) sorgu/belge saydığı istekleri kapsamla doğrular, hız sınırından geçirip aynı oturumla bir kez gönderir, yanıtı sınıflar (`core/hatalar.py`). Seçim: `GIB_ERISIM_YOLU` = `servis` (vars.) \| `robot` |
| `src/eworks_integration/transports/robot/` | başsız Chromium bağlamı; kuruma giden istekleri hız sınırından geçirir, demo/testte `*.gib.gov.tr`'yi sahte sunucuya yönlendirir ve kurum dışına çıkışı keser |
| `src/eworks_integration/institutions/gib/` | giriş (otomatik güvenlik kodu, şifre/kod hatası ayrımı), İVD geçişi, e-Beyanname sözleşme listesi (eski `Eworks-Python-Robot`'tan taşındı) |
| `tests/sahte_kurumlar/gib.py` | sahte GİB: gerçek ekran akışının taklidi, sentetik veri (canlı doğrulama sayılmaz, D33) |

Testler gerçek tarayıcı ister; imajla koşulur (yığın gerekmez):

```bash
docker build -f deploy/docker/integration.Dockerfile -t eworks/integration:local .
docker run --rm --ipc=host eworks/integration:local sh -c 'python3 -m pytest -q && lint-imports --no-cache'
```

`node tools/deploy/yigin.mjs test` bunları da çalıştırır. Kalan modüller (beyanname, SGK) testleriyle birlikte `institutions/...` altına alınır; testler önce sahte kurum sunucusuyla kırmızıya çevrilir (06 §9).

<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->

---

[README](../../README.md) › **Kurum entegrasyonu (ACL)**
<!-- /gezinti -->
