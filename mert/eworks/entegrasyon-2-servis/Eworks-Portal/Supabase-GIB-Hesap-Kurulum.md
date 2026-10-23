# GİB hesabının Supabase'de bir kez kaydedilmesi

Durum (16 Ekim 2026): Kullanıcı Vault SQL'ini başarıyla çalıştırdı ve
gib-account Edge Function'ını yayınladı. Eski JWT kapısı kapatıldı; işlevin
kendi doğrulamasının hem oturumsuz hem geçersiz oturumlu isteklere 401 verdiği
canlı olarak kontrol edildi. Geçerli Eworks oturumuyla Vault kayıt/okuma ve
gerçek GİB hesabını doldurma henüz doğrulanmadı.

## Proje sahibi hesabıyla bir defalık kurulum

1. Supabase SQL Editor'de `supabase-gib-vault.sql` dosyasının içeriğini çalıştırın.
   Bu dosyaya gerçek GİB kullanıcı adı veya şifre yazılmaz.
2. Edge Functions bölümünde `gib-account` işlevini oluşturun. Kaynak:
   `supabase/functions/gib-account/index.ts`. Ortamın varsayılan
   `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` değişkenlerini kullanır.
   Bu sunucu anahtarı HTML'ye, Python .env dosyasına veya sohbete eklenmez.
3. CLI ile dağıtımda `supabase/config.toml` kullanılır. Dashboard ile
   dağıtımda gateway'in eski JWT doğrulamasını kapatın: işlevin kendi
   `auth.getUser` doğrulaması zorunludur ve koddan kaldırılmamalıdır.
4. Varsayılan izin verilen web kökenleri localhost:8765 ve 127.0.0.1:8765'tir.
   İleride yayınlanan alan adını `EWORKS_ALLOWED_ORIGINS` ortam değişkenine
   ekleyin. Joker köken kullanmayın.

## Kullanıcı akışı

Eworks'e giriş yapın → Firmalarım → GİB Giriş Bilgileri → kullanıcı adı ve
şifreyi bir kez girip Supabase'e Şifreli Kaydet'e basın. Kaydın başarılı olduğu
mesajını bekleyin. Form alanları her istekten sonra temizlenir. Şifre tarayıcı
deposuna, portal genel veri JSON'una veya Windows'ta bir şifre dosyasına yazılmaz.

Bilgileri Güncelle düğmesi kısa ömürlü Eworks oturumunu yerel robota bellekte
iletir. Yerel sunucu kullanıcı kimliğini Supabase'de doğrular. Robot,
gib-account işlevinden yalnızca o kullanıcının Vault kaydını HTTPS ile alır.
GİB kullanıcı adı ve şifre resmî https://dijital.gib.gov.tr/portal/login
ekranındaki tekil etiketli alanlara doldurulur. CAPTCHA alanı değiştirilmez;
kullanıcı güvenlik kodunu girip Giriş Yap'a basar.

GİB oturumu ve şifre robotun çalıştığı bilgisayarın belleğinde kullanılır;
kalıcı saklama yeri Supabase Vault'tur. Supabase'de bilgileri tutmak, GİB
oturumunu süresiz açık tutmaz. Süresi dolunca yeni CAPTCHA gerekebilir.

Önceki canlı denemede tablo okuma ve 274 sözleşmenin kaydı doğrulandı. Menü
geçişi ve Tümünü Göster adımı canlı ortamda kullanıcı tarafından tamamlandı;
bu tıklamaların otomasyonu henüz tamamlanmış değildir.

## Veri ve yetki ayrımı

- `eworks_state`: portal verileri; GİB şifresi içermez.
- `eworks_private.gib_accounts`: kullanıcı UUID'si, Vault kayıt UUID'si ve tarih.
  Tarayıcıya tablo erişim yetkisi verilmez.
- Vault: kullanıcı adı ve şifreyi içeren şifreli kayıt.
- SQL servis işlevi: yalnızca service_role çağırabilir.
- Edge Function: kullanıcı UUID'sini doğrulanmış JWT'den türetir; istekteki
  bir kullanıcı UUID'sine güvenmez. Save/status yanıtlarında şifre dönmez.
  Robot okuma işlemi web Origin taşıyan isteklere kapalıdır.

Bu model proje yöneticisine karşı uçtan uca şifreleme değildir: Vault ve
sunucu yetkilerine sahip proje yöneticileri sırları yönetebilir. Supabase
hesabı silinirse eşleme silinir; eski Vault kaydının yönetici tarafından
temizlenmesi bu sürümde ayrıca yapılır.
