# Web (Next.js)

Genel kurallar: `../../CLAUDE.md`.

@AGENTS.md

## Bugünkü yapı
- `src/app/(panel)/*/page.tsx` ince sayfalar; mantık `src/components/*View.tsx`.
- `src/components/shell/` kabuk (ikon menü `nav.ts`, Ctrl+K paleti, tema).
- `src/lib/api.ts` API istemcisi (401 → `/login`, 403 `PASSWORD_CHANGE_REQUIRED` / `TWO_FACTOR_REQUIRED` yönlendirmesi).
- `src/content/faq.ts`, `changelog.ts`: özellik değişince güncelle.
- Tema: `globals.css` + `node scripts/gen-theme.mjs`.

## Hedef yapı (Faz 3 — henüz uygulanmadı)
- `src/features/<context>/` (bileşen + hook + api), `src/app/` yalnız route.
- Oturum BFF üzerinden: `src/app/bff/[...path]/route.ts` API'ye vekil, token HttpOnly çerezde. `localStorage`'da token **olmayacak**.
- Tipler `packages/contracts`; sunucu durumu TanStack Query; nonce'lu CSP (`middleware`/`proxy`).

## Kurallar
- Token veya kişisel veri `localStorage`/`sessionStorage`'a yazılmaz (yalnız tema, görülen sürüm notu gibi tercihler).
- `dangerouslySetInnerHTML` yok. TCKN ekranda maskeli.
- Üretim imajı `next build` + `output: 'standalone'`; değişiklik sonrası `npm run build -w web` geçmeli.
