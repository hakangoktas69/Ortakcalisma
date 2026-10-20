# 0005 — Anahtar yönetimi: OpenBao Transit (envelope encryption)

- **Durum:** Kabul (2026-10-20)
- **Bağlam:** Kurum şifreleri AES-256-GCM ile şifreli ama anahtar `VAULT_KEY` env değişkeninde; env/dump sızarsa tüm şifreler açılır. Barındırma TR on-prem → bulut KMS yok.
- **Karar:** `KeyManagementPort`: `local` (geliştirme, mevcut `v1` biçimi) ve `openbao` (prod). Prod'da tenant başına veri anahtarı (DEK) OpenBao Transit ile sarılır; şifreli metin öneki `v2:<keyVersion>`. `v1` okunmaya devam eder, worker işi yeniden şifreler.
- **Neden OpenBao:** HashiCorp Vault'un Linux Foundation altındaki açık kaynak (MPL) çatalı; self-hosted, Transit motoru, denetim log'u.

## Uygulama notu (2026-10-20)
- OpenBao 2.7: `file` depolama ve `mlock` desteği yok; yerleşik Raft depolama kullanıldı. Host'ta swap kapalı/şifreli olmalı.
- Tenant başına DEK yerine kurulum başına tek veri anahtarı (anahtar kimliği şifreli metinde: `v2:<kid>:…`); tenant başına anahtar gerekirse aynı biçimle eklenebilir.
- Uygulama token'ı süreli (768 saat) ve yalnız `transit/decrypt` + `datakey/wrapped` yetkili; çalışan süreçler yeniler.
