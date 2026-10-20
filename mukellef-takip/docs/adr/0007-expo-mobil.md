# 0007 — Mobil: Expo / React Native

- **Durum:** Kabul (2026-10-20); uygulama Faz 4
- **Karar:** Expo (expo-router, SecureStore, LocalAuthentication, Notifications, EAS Build). `packages/contracts` tipleri ve API istemcisi web ile paylaşılır. Kapsam: okuma + onay (iş kutusu, bildirim, tebligat, beyanname durumu, SGK rapor onayı); toplu veri girişi web'de kalır.
- **Güvenlik:** Push içeriğinde kişisel veri yok; sertifika sabitleme; arka planda ekran bulanıklaştırma; root/jailbreak uyarısı.
- **Reddedilen:** PWA (iOS'ta push/biyometri/güvenli depolama sınırlı), Flutter (dil/tip paylaşımı yok).
