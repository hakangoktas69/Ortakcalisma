# Web (Next.js)

Genel kurallar: `../../CLAUDE.md`.

@AGENTS.md

## Bugünkü yapı
- `src/app/(panel)/*/page.tsx` ince sayfalar; mantık `src/components/*View.tsx`.
- `src/components/shell/` kabuk (açılır-kapanır yan menü `Sidebar.tsx` + `nav.ts`, Ctrl+K paleti, tema).
- `src/lib/api.ts` API istemcisi (401 → `/login`, 403 `PASSWORD_CHANGE_REQUIRED` / `TWO_FACTOR_REQUIRED` yönlendirmesi).
- `src/content/faq.ts`, `changelog.ts`: özellik değişince güncelle.
- Tema: `globals.css` + `node scripts/gen-theme.mjs`.

## Hedef yapı (Faz 3 — henüz uygulanmadı)
- `src/features/<context>/` (bileşen + hook + api), `src/app/` yalnız route.
- Oturum BFF üzerinden: `src/app/bff/[...path]/route.ts` API'ye vekil, token HttpOnly çerezde. `localStorage`'da token **olmayacak**.
- Tipler `packages/contracts`; sunucu durumu TanStack Query; nonce'lu CSP (`middleware`/`proxy`).

## Duyarlı arayüz
Önyüz/ekran değişikliğinde aşağıdaki **tüm ekran sınıfları** denetlenir, sorunlar giderilir:

| Sınıf | Temsilî ölçü | Dikkat |
|---|---|---|
| Telefon | 375×812 | çekmece menü, taşma, dokunmatik hedef |
| Tablet | 768×1024 | `md` geçişi, açılır menü katmanları |
| Laptop | 1366×768 | kısa yükseklik: sabit üst/yan alan içeriği yutmasın |
| Büyük ekran | 1920×1080 | içerik gerilip boş alan bırakmasın |

- Kırılım noktaları Tailwind: `sm` 640, `md` 768 (yan menü görünür, altında çekmece), `lg` 1024, `xl` 1280.
- **Izgara:** `grid` her zaman temel sütun tanımıyla başlar: `grid grid-cols-1 lg:grid-cols-[...]`. Esnek sütun `1fr` değil `minmax(0,1fr)` (içerik sütunu genişletip taşırmasın).
- **Flex satırlarında** metin içeren çocuğa `min-w-0` + `truncate`/`break-words`.
- **Tablolar** `<div className="table-scroll overflow-x-auto …">` kabında: laptop altı ekranlarda yatay kayar, ilk sütun sabit kalır, diğer hücreler satır kırmaz (globals.css). Sabit piksel genişlik (`w-[600px]`) yerine `max-w-*`/`min-w-0`.
- **Katmanlar:** `sticky`/`fixed` kaplar yığın bağlamı kurar; açılır menü içeren kaba z değeri verin (yan menü `z-30`, üst bar `z-20`, çekmece `z-40`).
- Dokunmatik hedefler en az ~40px; hover'a bağlı bilgi dokunmatikte de erişilebilir olmalı.
- Doğrulama: `npm run test:ui` (apps/web/e2e) her sayfayı tablodaki 4 ekranda açar (`playwright.config.ts` `VIEWPORTS`); yatay taşma, kırpılma, çalışma anı/konsol hatası ve API 5xx'te başarısız olur. Yeni sayfa → `e2e/support.ts` `PANEL_ROUTES`.

## Kurallar
- Token veya kişisel veri `localStorage`/`sessionStorage`'a yazılmaz (yalnız tema, görülen sürüm notu gibi tercihler).
- `dangerouslySetInnerHTML` yok. TCKN ekranda maskeli.
- Canlı imajı `next build` + `output: 'standalone'`; `npm run build -w web` önce tip denetimi (`next typegen`), lint ve birim testlerini çalıştırır (prebuild).
