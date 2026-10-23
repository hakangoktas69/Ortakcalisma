# 3.4 Test

> Önce: [İlk gün](01-ilk-gun.md) · İlgili: [Eksikler M-10](../04-eksikler-ve-riskler/01-mimari-yapisal-eksikler.md)

## Mevcut test türleri

| Tür | Dosyalar | Araç | Ön koşul |
|---|---|---|---|
| Robot birim (sentetik HTML/PDF) | `Eworks-Python-Robot/test_*.py` (28) | `unittest` | Python ortamı |
| Robot UI | `test_portal_ui.py`, `test_portal_review_ui.py`, `test_firm_account_ui.py`, `test_demo_cleanup_ui.py`, `test_declaration_pdf_viewer.py` | `unittest` + Playwright | Kurulu Chrome |
| Edge Function | `test_edge_function.mjs` | Node (`stripTypeScriptTypes`) | Node ≥22.6 |
| Portal JS | `Eworks-Portal/test-demo-cleanup.cjs`, `test-institution-review.cjs` | `node <dosya>` | Node |
| Canlı kabul | `GIB-Canli-Akis.md` (elle, belgeyle) | — | Gerçek GİB hesabı |

## Koşma

```powershell
cd mert\eworks\entegrasyon-1-tarayici\Eworks-Python-Robot
# Yeşil olduğu doğrulanan küme (VALIDATION.md, 48 test):
python -m unittest test_declaration_adapter test_declaration_reader test_declaration_sync test_declaration_documents test_muhsgk_sgk_reader test_sgk_employee_count test_portal_bridge test_declaration_pdf_viewer
# Tümü (bazıları arşiv uyumsuzluğu nedeniyle kırmızı olabilir):
python -m unittest
node test_edge_function.mjs
cd ..\Eworks-Portal; node test-demo-cleanup.cjs; node test-institution-review.cjs
```

## Neyi kapsamıyor

- **SQL/RLS:** başka kullanıcının satırını okuma/yazma, `anon` erişimi, `eworks_commit` çakışma/idempotens testleri yok. Tek güvence çalışma anındaki `eworks_security_check()`.
- **Supabase entegrasyonu:** gerçek (yerel) Supabase'e karşı uçtan uca test yok.
- **Portal:** 244 KB'lık HTML'in iş kuralları (firma birleştirme, kayıt kuyruğu) için birim test yok.
- **CI:** yok; kapsam ölçümü yok.
- **Canlı GİB:** otomatik test edilemez; tek kanıt elle yazılmış kabul notları.

## Kurallar (öneri — ekip onayı bekliyor)

1. Her hata düzeltmesi önce kırmızı bir sentetik testle başlar.
2. GİB ekran fikstürleri gerçek veriden **arındırılmış** olmalı: sahte VKN/TCKN (ör. `1111111111`), sahte unvan. Gerçek ekran görüntüsü/PDF commit edilmez.
3. Güvenlik kontrolü içeren her uç noktaya en az bir "reddedilmeli" testi (yanlış Origin, eksik token, büyük gövde, başka owner).
4. Yeni SQL için `hkazaz/docker/mert` yerel Supabase'inde iki kullanıcıyla elle RLS denemesi; ileride pgTAP.
5. `VALIDATION.md` kümesi küçülmez; kırmızı testler ya düzeltilir ya da gerekçesiyle `skip` edilir.
