# Eworks — ekip bağlamı

Bu dosya yalnız `mert/eworks/` içindir. Önce [ekip hafızasını](docs/ai/memory/MEMORY.md) ve [güncel durumu](docs/ai/memory/guncel-durum.md) okuyun.

- İlk sürüm proje dışında `../eworks-arsiv/entegrasyon-1-tarayici/` altında salt tarihsel arşivdir; yeni geliştirmeleri buraya taşımayın.
- Ana proje `entegrasyon-2-servis/` üzerinden yürür. e-Defter yalnız ikinci entegrasyon yöntemiyle geliştirilecektir. Bu dizin ikinci entegrasyonun paylaşılabilir kaynak kopyasıdır. Çalışan özel aktarım ortamıyla aynı klasör değildir.
- 26 Ekim 2026 kullanıcının güncel talimatı: Yeni işleri yalnız `mert/eworks-ikinci-entegrasyon` kişisel dalında küçük commitler halinde kaydedip bu dala push edin. Git Flow / feature start-finish akışını kullanmayın. `dev` veya `main` dalına merge/push ya da bu dalları hedefleyen birleştirme işlemi yapmayın. Yeni proje yapısına uyarlamayı ekip sorumlusu yapacak. Önceki `dev` commitlerini kendiliğinden geri almayın. Bu kural eski Git Flow rehberinin yerine geçer.
- `.env`, parola, token, gerçek VKN/TCKN, mükellef isimleri, PDF'ler, özel iş sonuçları ve yerel yorumlayıcı ayarları Git'e girmez. Bağlantı sabitleri paylaşım kopyasında şablondur.
- Eworks bilgileri bu dizinin `docs/ai/memory/` alanında tutulur. Başka ekip üyelerinin klasörlerini veya `mukellef-takip/` uygulamasını bu işle değiştirmeyin.
- İkinci yöntem GİB'in gözlenen web oturumunu kullanır; bağımsız, resmî ve herkese açık bir API sözleşmesi değildir. Kapsam, kaynak kayıt, sahiplik ve içerik doğrulamalarını kaldırmayın.
- Canlı sorgu, PDF indirme ve portal kaydı ayrı işlemlerdir. Sentetik test başarısı canlı aktarımın tamamlandığı anlamına gelmez. Oturum/CAPTCHA adımlarında kullanılan aracın kurallarını uygulayın.
- Kullanıcının son kapsamı: 22 Temmuz–31 Ağustos 2026. Önceki 11 belge hatası çözüldü; kalan toplu aktarım beklemede. Açık talep olmadan toplu işi devam ettirmeyin. Eylül/Ekim için yeni toplu sorgu yok.

Devam eden işin teknik haritası: [mimari](docs/ai/memory/mimari.md). Kurulum: [ikinci entegrasyon](entegrasyon-2-servis/README.md).
