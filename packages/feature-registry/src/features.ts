import type { ContextName, FeatureDef } from './define.ts';

// Özellik ağacının tamamı (06 §9: Faz 0). Anahtarlar 05 §3.1 yetki ağacındaki adlardır; bugünkü portalın
// (eski/mert/eworks/entegrasyon-1-tarayici/Eworks-Portal/eworks-tasarim.html, NAV) tüm ekran ve işlemleri ağaçtadır.
// Kabul testi yazılmadıkça her düğüm KIRMIZIDIR (durum tools/features ile test sonuçlarından hesaplanır, elle işaretlenmez).
// Yeni özellik: önce buraya anahtar, sonra @F:<anahtar> etiketli kırmızı kabul testi (06 §7.1).

type Src = NonNullable<FeatureDef['source']>;
type Tree = Record<string, FeatureDef>;

const mod = (key: string, title: string, context: ContextName | null, source: Src, ...parts: Tree[]): Tree =>
  Object.assign({ [key]: { title, kind: 'module', context, source } }, ...parts);

/** Sayfa + işlemleri. `ctx` verilirse sayfa modülün bağlamını ezer. */
const page = (key: string, title: string, actions: Record<string, string>, source: Src, ctx?: ContextName | null): Tree => {
  const out: Tree = { [key]: { title, kind: 'page', source, ...(ctx !== undefined ? { context: ctx } : {}) } };
  for (const [a, t] of Object.entries(actions)) out[`${key}.${a}`] = { title: t, kind: 'action', acceptance: true, source };
  return out;
};

/** Modüle doğrudan bağlı işlemler (sayfasız). */
const actions = (key: string, list: Record<string, string>, source: Src): Tree => {
  const out: Tree = {};
  for (const [a, t] of Object.entries(list)) out[`${key}.${a}`] = { title: t, kind: 'action', acceptance: true, source };
  return out;
};

const V = { view: 'Görüntüle' };

// Kurumla konuşan işlemler (D33): kuruma istek atar ya da kurumdan veri çeker; canlı doğrulama kaydı ister.
export const LIVE_ACTIONS = [
  'firmalar.gib_sozlesmeler.sync',
  'beyanname.senkron.start',
  'genel_bakis.takvim.sync',
  'tebligat.liste.sync',
  'sgk.ebildirge.sync',
  'sgk.ise_giris_cikis.sync',
  'sgk.erapor.sync',
  'sgk.erapor.approve',
  'sgk.is_kazasi.sync',
] as const;

const tree: Tree = {
  ...mod('oturum', 'Oturum', 'identity-access', 'portal',
    page('oturum.giris', 'Giriş', { login: 'Giriş yap' }, 'portal'),
    page('oturum.sifre_sifirlama', 'Şifremi unuttum', { reset: 'Şifre sıfırla' }, 'portal'),
    page('oturum.mfa', 'İki adımlı doğrulama', { setup: 'Kur', verify: 'Doğrula' }, 'hedef'),
  ),
  ...mod('genel_bakis', 'Ana Sayfa', 'workspace', 'portal',
    page('genel_bakis.panel', 'Genel bakış', { ...V }, 'portal'),
    page('genel_bakis.takvim', 'Takvim', { ...V, edit: 'Tarihi düzelt', remind: 'Hatırlatma ekle', sync: 'Takvimi kaynaklardan güncelle' }, 'portal'),
  ),
  ...mod('firmalar', 'Firmalarım', 'portfolio', 'portal',
    page('firmalar.liste', 'Firma listesi', { ...V, export: 'Dışa aktar' }, 'portal'),
    page('firmalar.kart', 'Firma kartı', { ...V, create: 'Yeni firma', edit: 'Düzenle', archive: 'Arşivle' }, 'portal'),
    page('firmalar.kurum_hesaplari', 'Kurum hesapları',
      { view_status: 'Durumu gör', edit_credentials: 'Bilgileri gir', grant_use: 'Kullanım izni ver', consent: 'Mükellef onayı' }, 'portal', 'credentials'),
    page('firmalar.gib_sozlesmeler', 'GİB e-Beyanname sözleşmeleri', { ...V, sync: 'GİB\'den güncelle', review: 'Kurum incelemesi' }, 'portal', 'tax-filing'),
    page('firmalar.devir', 'Müşavir devri', { start: 'Devir başlat', object: 'İtiraz et' }, 'hedef'),
  ),
  ...mod('beyanname', 'e-Beyanname', 'tax-filing', 'portal',
    page('beyanname.liste', 'e-Beyanname görüntüleme', { ...V, export: 'Dışa aktar' }, 'portal'),
    page('beyanname.kontrol', 'e-Beyanname kontrol', { ...V }, 'portal'),
    page('beyanname.belge', 'Beyanname / tahakkuk PDF', { ...V, download: 'PDF indir' }, 'portal', 'documents'),
    page('beyanname.senkron', 'Beyanname senkronu', { start: 'Senkron başlat', cancel: 'İptal et' }, 'portal', 'sync'),
    page('beyanname.pilot_bolge', 'Pilot bölge ayarları', { ...V, edit: 'Düzenle' }, 'portal'),
  ),
  ...mod('tebligat', 'e-Tebligat', null, 'portal',
    page('tebligat.liste', 'e-Tebligat listesi', { ...V, sync: 'Güncelle' }, 'portal'),
  ),
  ...mod('sgk', 'SGK', 'social-security', 'portal',
    page('sgk.kontrol', 'SGK kontrol listesi', { ...V }, 'portal'),
    page('sgk.ebildirge', 'e-Bildirge', { ...V, download: 'PDF indir', sync: 'Toplu güncelle' }, 'portal'),
    page('sgk.ise_giris_cikis', 'İşe giriş çıkış', { ...V, sync: 'Toplu güncelle' }, 'portal'),
    page('sgk.erapor', 'SGK e-Rapor', { ...V, sync: 'Toplu güncelle', approve: 'Çalışmazlık onayı' }, 'portal'),
    page('sgk.is_kazasi', 'İş kazası', { ...V, sync: 'Toplu güncelle' }, 'portal'),
  ),
  ...mod('edefter', 'e-Defter', null, 'portal',
    page('edefter.liste', 'e-Defter berat durumu', { ...V, review: 'Dönem incelemesi' }, 'portal'),
  ),
  ...mod('dilekceler', 'Dilekçeler', null, 'portal',
    page('dilekceler.tum', 'Tüm dilekçeler', { ...V, create: 'Yeni dilekçe' }, 'portal'),
    page('dilekceler.borc_durum', 'Borç durum yazısı', { ...V, create: 'Oluştur' }, 'portal'),
  ),
  ...mod('faturalar', 'Faturalar', null, 'portal',
    page('faturalar.efatura', 'e-Faturalar', { ...V }, 'portal'),
    page('faturalar.earsiv', 'e-Arşiv faturalar', { ...V }, 'portal'),
    page('faturalar.fis', 'Fiş takip', { ...V }, 'portal'),
    page('faturalar.tevkifat', 'Tevkifat kontrol', { ...V }, 'portal'),
  ),
  ...mod('gorevler', 'Görevler', 'workspace', 'portal',
    actions('gorevler', { view: 'Görüntüle', create: 'Oluştur', assign: 'Ata', close: 'Kapat' }, 'portal'),
  ),
  ...mod('notlar', 'Notlar', 'workspace', 'portal',
    actions('notlar', { view: 'Görüntüle', create: 'Oluştur' }, 'portal'),
  ),
  ...mod('kisayollar', 'Portal kısayolları', 'workspace', 'portal',
    actions('kisayollar', { view: 'Görüntüle' }, 'portal'),
  ),
  ...mod('bildirimler', 'Uyarılar ve bildirimler', 'notifications', 'portal',
    actions('bildirimler', { view: 'Görüntüle', mark_read: 'Okundu işaretle' }, 'portal'),
  ),
  ...mod('raporlar', 'Raporlar', 'workspace', 'portal',
    page('raporlar.pos', 'POS + TÖDEB', { ...V, export: 'Dışa aktar' }, 'portal', null),
    page('raporlar.kayitli_araclar', 'Kayıtlı araçlar', { ...V, export: 'Dışa aktar' }, 'portal', null),
    page('raporlar.ticaret_sicil', 'Ticaret Sicil Gazetesi', { ...V, export: 'Dışa aktar' }, 'portal', null),
    page('raporlar.karsit_inceleme', 'Karşıt inceleme', { ...V, export: 'Dışa aktar' }, 'portal', null),
  ),
  ...mod('odeme', 'Ödeme', null, 'portal',
    page('odeme.aylik_liste', 'Aylık ödeme listesi', { ...V }, 'portal'),
    page('odeme.cari_kasa', 'Cari kasa', { ...V }, 'portal'),
    page('odeme.borclar', 'Vergi ve SGK borçları', { ...V }, 'portal'),
    page('odeme.online', 'Online ödeme', { ...V }, 'portal'),
    page('odeme.ucretler', 'Ücret yönetimi', { ...V, edit: 'Düzenle' }, 'portal'),
    page('odeme.istatistikler', 'İstatistikler', { ...V }, 'portal'),
    page('odeme.ayarlar', 'Ödeme ayarları', { ...V, edit: 'Düzenle' }, 'portal'),
  ),
  ...mod('yonetim', 'Yönetim', 'identity-access', 'portal',
    page('yonetim.kullanicilar', 'Ofis kullanıcıları', { ...V, invite: 'Davet et', edit_permissions: 'Yetkileri düzenle' }, 'portal'),
    page('yonetim.mukellef_kullanicilari', 'Mükellef kullanıcıları', { ...V, invite: 'Davet et' }, 'portal', 'portfolio'),
    page('yonetim.zamanlama', 'Gece işleri zamanlaması', { ...V, edit: 'Düzenle' }, 'hedef', 'sync'),
    page('yonetim.belge_temizligi', 'Belge temizliği', { run: 'Temizliği çalıştır' }, 'hedef', 'documents'),
    page('yonetim.hiz_politikasi', 'Kurum istek hızı', { ...V, edit: 'Düzenle' }, 'hedef', 'sync'),
    page('yonetim.denetim_kaydi', 'Denetim kaydı', { ...V }, 'hedef', 'audit'),
  ),
  ...mod('ayarlar', 'Ayarlar', 'organization', 'portal',
    page('ayarlar.profil', 'Bilgilerim', { ...V, edit: 'Düzenle' }, 'portal', 'identity-access'),
    page('ayarlar.iletisim', 'SMS / WhatsApp / e-posta', { ...V, edit: 'Düzenle' }, 'portal', 'notifications'),
    page('ayarlar.mukellef_gruplari', 'Mükellef grupları', { ...V, edit: 'Düzenle' }, 'portal', 'portfolio'),
    page('ayarlar.portal_kullanimi', 'Portal kullanımı', { ...V }, 'portal'),
  ),
  ...mod('destek', 'Destek', null, 'portal',
    page('destek.uzmana_sor', 'Uzmana sor', { ask: 'Soru sor' }, 'portal'),
    page('destek.oneriler', 'Öneriler', { create: 'Öneri gönder' }, 'portal'),
    page('destek.sss', 'Sıkça sorulan sorular', { ...V }, 'portal'),
    page('destek.yenilikler', 'Yenilikler', { ...V }, 'portal'),
  ),
  ...mod('satis', 'Satış portalı', 'sales', 'hedef',
    page('satis.oturum', 'Satış girişi', { login: 'Giriş yap', mfa: 'İki adımlı doğrulama' }, 'hedef'),
    page('satis.ofis', 'Ofis hesabı', { ...V, create: 'Ofis aç', freeze: 'Dondur', extend: 'Lisans uzat' }, 'hedef'),
    page('satis.musavir', 'Müşavir hesabı', { create: 'Müşavir aç' }, 'hedef'),
    page('satis.mukellef', 'Mükellef hesabı', { create: 'Mükellef aç', contract: 'Sözleşme ve onay kaydı' }, 'hedef'),
    page('satis.ekip', 'Satış ekibi', { ...V, invite: 'Davet et' }, 'hedef'),
  ),
};

for (const k of LIVE_ACTIONS) tree[k] = { ...tree[k]!, live: true };

export const features: Readonly<Tree> = tree;
