# Özellik durumu

> **Üretilen dosya — elle düzenlemeyin.** Kaynak: `packages/feature-registry/src/features.ts` + test sonuçları; üretici `pnpm features` ([06 §8](hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#8-özellik-durumu-ve-ön-yüzde-kırmızıyeşil-işaretleme-d22)).
> 🔴 tamamlanmadı (kabul testi yok ya da biri geçmiyor) · 🟢 tamamlandı. Sayılar: yeşil işlem / toplam işlem, test sayısı.
> "canlı": kurumla konuşan işlem (D33) — sahte kurum testlerine ek olarak `packages/feature-registry/canli-dogrulamalar.json` kaydı ister.

| Özellik | Anahtar | Bağlam | Durum | Testler |
|---|---|---|---|---|
| **Oturum** | `oturum` | identity-access | 🔴 1/4 | 10 |
| &nbsp;&nbsp;&nbsp;&nbsp;Giriş | `oturum.giris` | identity-access | 🟢 1/1 | 10 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Giriş yap | `oturum.giris.login` | identity-access | 🟢 | 10 |
| &nbsp;&nbsp;&nbsp;&nbsp;Şifremi unuttum | `oturum.sifre_sifirlama` | identity-access | 🔴 0/1 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Şifre sıfırla | `oturum.sifre_sifirlama.reset` | identity-access | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;İki adımlı doğrulama | `oturum.mfa` | identity-access | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Kur | `oturum.mfa.setup` | identity-access | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Doğrula | `oturum.mfa.verify` | identity-access | 🔴 | 0 |
| **Ana Sayfa** | `genel_bakis` | workspace | 🔴 1/2 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;Genel bakış | `genel_bakis.panel` | workspace | 🟢 1/1 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `genel_bakis.panel.view` | workspace | 🟢 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;Takvim | `genel_bakis.takvim` | workspace | 🔴 0/1 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `genel_bakis.takvim.view` | workspace | 🔴 | 0 |
| **Firmalarım** | `firmalar` | portfolio | 🔴 10/15 | 57 |
| &nbsp;&nbsp;&nbsp;&nbsp;Firma listesi | `firmalar.liste` | portfolio | 🟢 2/2 | 9 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `firmalar.liste.view` | portfolio | 🟢 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Dışa aktar | `firmalar.liste.export` | portfolio | 🟢 | 5 |
| &nbsp;&nbsp;&nbsp;&nbsp;Firma kartı | `firmalar.kart` | portfolio | 🟢 4/4 | 24 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `firmalar.kart.view` | portfolio | 🟢 | 8 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Yeni firma | `firmalar.kart.create` | portfolio | 🟢 | 8 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Düzenle | `firmalar.kart.edit` | portfolio | 🟢 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Arşivle | `firmalar.kart.archive` | portfolio | 🟢 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;Kurum hesapları | `firmalar.kurum_hesaplari` | credentials | 🔴 2/4 | 8 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Durumu gör | `firmalar.kurum_hesaplari.view_status` | credentials | 🟢 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Bilgileri gir | `firmalar.kurum_hesaplari.edit_credentials` | credentials | 🟢 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Kullanım izni ver | `firmalar.kurum_hesaplari.grant_use` | credentials | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Mükellef onayı | `firmalar.kurum_hesaplari.consent` | credentials | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;GİB e-Beyanname sözleşmeleri | `firmalar.gib_sozlesmeler` | tax-filing | 🔴 2/3 | 16 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `firmalar.gib_sozlesmeler.view` | tax-filing | 🟢 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;GİB'den güncelle | `firmalar.gib_sozlesmeler.sync` | tax-filing | 🔴 canlı | 8 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Kurum incelemesi | `firmalar.gib_sozlesmeler.review` | tax-filing | 🟢 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;Müşavir devri | `firmalar.devir` | portfolio | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Devir başlat | `firmalar.devir.start` | portfolio | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;İtiraz et | `firmalar.devir.object` | portfolio | 🔴 | 0 |
| **e-Beyanname** | `beyanname` | tax-filing | 🔴 5/9 | 25 |
| &nbsp;&nbsp;&nbsp;&nbsp;e-Beyanname görüntüleme | `beyanname.liste` | tax-filing | 🟢 2/2 | 8 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `beyanname.liste.view` | tax-filing | 🟢 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Dışa aktar | `beyanname.liste.export` | tax-filing | 🟢 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;e-Beyanname kontrol | `beyanname.kontrol` | tax-filing | 🟢 1/1 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `beyanname.kontrol.view` | tax-filing | 🟢 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;Beyanname / tahakkuk PDF | `beyanname.belge` | documents | 🟢 2/2 | 8 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `beyanname.belge.view` | documents | 🟢 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;PDF indir | `beyanname.belge.download` | documents | 🟢 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;Beyanname senkronu | `beyanname.senkron` | sync | 🔴 0/2 | 5 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Senkron başlat | `beyanname.senkron.start` | sync | 🔴 canlı | 5 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;İptal et | `beyanname.senkron.cancel` | sync | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Pilot bölge ayarları | `beyanname.pilot_bolge` | tax-filing | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `beyanname.pilot_bolge.view` | tax-filing | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Düzenle | `beyanname.pilot_bolge.edit` | tax-filing | 🔴 | 0 |
| **e-Tebligat** | `tebligat` | — (atanmadı) | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;e-Tebligat listesi | `tebligat.liste` | — (atanmadı) | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `tebligat.liste.view` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Güncelle | `tebligat.liste.sync` | — (atanmadı) | 🔴 canlı | 0 |
| **SGK** | `sgk` | social-security | 🔴 3/11 | 17 |
| &nbsp;&nbsp;&nbsp;&nbsp;SGK kontrol listesi | `sgk.kontrol` | social-security | 🟢 1/1 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `sgk.kontrol.view` | social-security | 🟢 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;e-Bildirge | `sgk.ebildirge` | social-security | 🔴 2/3 | 13 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `sgk.ebildirge.view` | social-security | 🟢 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;PDF indir | `sgk.ebildirge.download` | social-security | 🟢 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Toplu güncelle | `sgk.ebildirge.sync` | social-security | 🔴 canlı | 5 |
| &nbsp;&nbsp;&nbsp;&nbsp;İşe giriş çıkış | `sgk.ise_giris_cikis` | social-security | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `sgk.ise_giris_cikis.view` | social-security | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Toplu güncelle | `sgk.ise_giris_cikis.sync` | social-security | 🔴 canlı | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;SGK e-Rapor | `sgk.erapor` | social-security | 🔴 0/3 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `sgk.erapor.view` | social-security | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Toplu güncelle | `sgk.erapor.sync` | social-security | 🔴 canlı | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Çalışmazlık onayı | `sgk.erapor.approve` | social-security | 🔴 canlı | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;İş kazası | `sgk.is_kazasi` | social-security | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `sgk.is_kazasi.view` | social-security | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Toplu güncelle | `sgk.is_kazasi.sync` | social-security | 🔴 canlı | 0 |
| **e-Defter** | `edefter` | — (atanmadı) | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;e-Defter berat durumu | `edefter.liste` | — (atanmadı) | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `edefter.liste.view` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Dönem incelemesi | `edefter.liste.review` | — (atanmadı) | 🔴 | 0 |
| **Dilekçeler** | `dilekceler` | — (atanmadı) | 🔴 0/4 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tüm dilekçeler | `dilekceler.tum` | — (atanmadı) | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `dilekceler.tum.view` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Yeni dilekçe | `dilekceler.tum.create` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Borç durum yazısı | `dilekceler.borc_durum` | — (atanmadı) | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `dilekceler.borc_durum.view` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Oluştur | `dilekceler.borc_durum.create` | — (atanmadı) | 🔴 | 0 |
| **Faturalar** | `faturalar` | — (atanmadı) | 🔴 0/4 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;e-Faturalar | `faturalar.efatura` | — (atanmadı) | 🔴 0/1 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `faturalar.efatura.view` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;e-Arşiv faturalar | `faturalar.earsiv` | — (atanmadı) | 🔴 0/1 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `faturalar.earsiv.view` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Fiş takip | `faturalar.fis` | — (atanmadı) | 🔴 0/1 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `faturalar.fis.view` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Tevkifat kontrol | `faturalar.tevkifat` | — (atanmadı) | 🔴 0/1 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `faturalar.tevkifat.view` | — (atanmadı) | 🔴 | 0 |
| **Görevler** | `gorevler` | workspace | 🟢 4/4 | 16 |
| &nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `gorevler.view` | workspace | 🟢 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;Oluştur | `gorevler.create` | workspace | 🟢 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;Ata | `gorevler.assign` | workspace | 🟢 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;Kapat | `gorevler.close` | workspace | 🟢 | 4 |
| **Notlar** | `notlar` | workspace | 🟢 2/2 | 8 |
| &nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `notlar.view` | workspace | 🟢 | 4 |
| &nbsp;&nbsp;&nbsp;&nbsp;Oluştur | `notlar.create` | workspace | 🟢 | 4 |
| **Uyarılar ve bildirimler** | `bildirimler` | notifications | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `bildirimler.view` | notifications | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Okundu işaretle | `bildirimler.mark_read` | notifications | 🔴 | 0 |
| **Raporlar** | `raporlar` | workspace | 🔴 0/8 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;POS + TÖDEB | `raporlar.pos` | — (atanmadı) | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `raporlar.pos.view` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Dışa aktar | `raporlar.pos.export` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Kayıtlı araçlar | `raporlar.kayitli_araclar` | — (atanmadı) | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `raporlar.kayitli_araclar.view` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Dışa aktar | `raporlar.kayitli_araclar.export` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Ticaret Sicil Gazetesi | `raporlar.ticaret_sicil` | — (atanmadı) | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `raporlar.ticaret_sicil.view` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Dışa aktar | `raporlar.ticaret_sicil.export` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Karşıt inceleme | `raporlar.karsit_inceleme` | — (atanmadı) | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `raporlar.karsit_inceleme.view` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Dışa aktar | `raporlar.karsit_inceleme.export` | — (atanmadı) | 🔴 | 0 |
| **Ödeme** | `odeme` | — (atanmadı) | 🔴 0/9 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Aylık ödeme listesi | `odeme.aylik_liste` | — (atanmadı) | 🔴 0/1 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `odeme.aylik_liste.view` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Cari kasa | `odeme.cari_kasa` | — (atanmadı) | 🔴 0/1 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `odeme.cari_kasa.view` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Vergi ve SGK borçları | `odeme.borclar` | — (atanmadı) | 🔴 0/1 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `odeme.borclar.view` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Online ödeme | `odeme.online` | — (atanmadı) | 🔴 0/1 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `odeme.online.view` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Ücret yönetimi | `odeme.ucretler` | — (atanmadı) | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `odeme.ucretler.view` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Düzenle | `odeme.ucretler.edit` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;İstatistikler | `odeme.istatistikler` | — (atanmadı) | 🔴 0/1 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `odeme.istatistikler.view` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Ödeme ayarları | `odeme.ayarlar` | — (atanmadı) | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `odeme.ayarlar.view` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Düzenle | `odeme.ayarlar.edit` | — (atanmadı) | 🔴 | 0 |
| **Yönetim** | `yonetim` | identity-access | 🔴 0/11 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Ofis kullanıcıları | `yonetim.kullanicilar` | identity-access | 🔴 0/3 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `yonetim.kullanicilar.view` | identity-access | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Davet et | `yonetim.kullanicilar.invite` | identity-access | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Yetkileri düzenle | `yonetim.kullanicilar.edit_permissions` | identity-access | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Mükellef kullanıcıları | `yonetim.mukellef_kullanicilari` | portfolio | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `yonetim.mukellef_kullanicilari.view` | portfolio | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Davet et | `yonetim.mukellef_kullanicilari.invite` | portfolio | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Gece işleri zamanlaması | `yonetim.zamanlama` | sync | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `yonetim.zamanlama.view` | sync | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Düzenle | `yonetim.zamanlama.edit` | sync | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Belge temizliği | `yonetim.belge_temizligi` | documents | 🔴 0/1 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Temizliği çalıştır | `yonetim.belge_temizligi.run` | documents | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Kurum istek hızı | `yonetim.hiz_politikasi` | sync | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `yonetim.hiz_politikasi.view` | sync | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Düzenle | `yonetim.hiz_politikasi.edit` | sync | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Denetim kaydı | `yonetim.denetim_kaydi` | audit | 🔴 0/1 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `yonetim.denetim_kaydi.view` | audit | 🔴 | 0 |
| **Ayarlar** | `ayarlar` | organization | 🔴 0/7 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Bilgilerim | `ayarlar.profil` | identity-access | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `ayarlar.profil.view` | identity-access | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Düzenle | `ayarlar.profil.edit` | identity-access | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;SMS / WhatsApp / e-posta | `ayarlar.iletisim` | notifications | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `ayarlar.iletisim.view` | notifications | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Düzenle | `ayarlar.iletisim.edit` | notifications | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Mükellef grupları | `ayarlar.mukellef_gruplari` | portfolio | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `ayarlar.mukellef_gruplari.view` | portfolio | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Düzenle | `ayarlar.mukellef_gruplari.edit` | portfolio | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Portal kullanımı | `ayarlar.portal_kullanimi` | organization | 🔴 0/1 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `ayarlar.portal_kullanimi.view` | organization | 🔴 | 0 |
| **Destek** | `destek` | — (atanmadı) | 🔴 0/4 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Uzmana sor | `destek.uzmana_sor` | — (atanmadı) | 🔴 0/1 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Soru sor | `destek.uzmana_sor.ask` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Öneriler | `destek.oneriler` | — (atanmadı) | 🔴 0/1 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Öneri gönder | `destek.oneriler.create` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Sıkça sorulan sorular | `destek.sss` | — (atanmadı) | 🔴 0/1 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `destek.sss.view` | — (atanmadı) | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Yenilikler | `destek.yenilikler` | — (atanmadı) | 🔴 0/1 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `destek.yenilikler.view` | — (atanmadı) | 🔴 | 0 |
| **Satış portalı** | `satis` | sales | 🔴 0/7 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Ofis hesabı | `satis.ofis` | sales | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Ofis aç | `satis.ofis.create` | sales | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Dondur | `satis.ofis.freeze` | sales | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Müşavir hesabı | `satis.musavir` | sales | 🔴 0/1 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Müşavir aç | `satis.musavir.create` | sales | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Mükellef hesabı | `satis.mukellef` | sales | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Mükellef aç | `satis.mukellef.create` | sales | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Sözleşme ve onay kaydı | `satis.mukellef.contract` | sales | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;Satış ekibi | `satis.ekip` | sales | 🔴 0/2 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Görüntüle | `satis.ekip.view` | sales | 🔴 | 0 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Davet et | `satis.ekip.invite` | sales | 🔴 | 0 |
