# İlk entegrasyon doğrulaması — 22 Ekim 2026

- Developer/network denemesinden önceki 70 kaynak dosyası, 21 Ekim envanterinin SHA-256 değerleriyle birebir eşleştirildi.
- Paylaşım kopyasında canlı Supabase bağlantı sabitleri şablonlarla değiştirildi. Kurulum belgeleri ve bağımlılıklar eklendi.
- Arşivdeki liste okuyucu testlerinde üç çağrı `Page` yerine gerçek çalışma akışındaki `Page.main_frame` kullanacak şekilde düzeltildi. Üretim okuyucu kodu değiştirilmedi.
- Beyanname adaptörü/okuyucu/senkronizasyon, PDF doğrulama ve depolama, MUHSGK belge okuyucu, çalışan sayısı, yerel HTTP köprü ve PDF görüntüleyici kapsamındaki **48 sentetik test geçti**.
- Test komutu, `entegrasyon-1-tarayici/Eworks-Python-Robot` dizininde:

```powershell
python -m unittest test_declaration_adapter test_declaration_reader test_declaration_sync test_declaration_documents test_muhsgk_sgk_reader test_sgk_employee_count test_portal_bridge test_declaration_pdf_viewer
```

Bu kontrol canlı GİB sorgusu veya müşteri belgesi indirmesi yapmadı. Canlı servisin erişilebilirliği ve tüm mükelleflerin taranması hakkında sonuç çıkarmaz.
