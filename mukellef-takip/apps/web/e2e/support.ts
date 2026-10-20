import type { Page } from "@playwright/test";

// UI testlerinin ortak yardımcıları: sayfa listesi, hata gözlemcisi, taşma/kırpılma ölçümü.

export const PANEL_ROUTES = [
  { path: "/", name: "İş kutusu" },
  { path: "/ozet", name: "Genel bakış" },
  { path: "/firmalar", name: "Mükellefler" },
  { path: "/beyanname", name: "Beyanname" },
  { path: "/edefter", name: "e-Defter" },
  { path: "/tebligat", name: "e-Tebligat" },
  { path: "/sgk", name: "SGK" },
  { path: "/faturalar", name: "Faturalar" },
  { path: "/bordro", name: "Bordro" },
  { path: "/dilekceler", name: "Dilekçeler" },
  { path: "/raporlar", name: "Raporlar" },
  { path: "/asistan", name: "Uzmana Sor" },
  { path: "/kullanicilar", name: "Kullanıcılar" },
  { path: "/odeme", name: "Lisans ve ödeme" },
  { path: "/ayarlar", name: "Ayarlar" },
  { path: "/sss", name: "SSS" },
  { path: "/yenilikler", name: "Yenilikler" },
];

/** Sayfa hatalarını, konsol hatalarını ve başarısız API yanıtlarını toplar. */
export function watch(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`Çalışma anı hatası: ${e.message}`));
  page.on("console", (m) => {
    // COOP uyarısı yalnız https olmayan, localhost dışı test adresinde çıkar (üretim https)
    if (m.type() === "error" && !/Failed to load resource|Cross-Origin-Opener-Policy/.test(m.text())) problems.push(`Konsol hatası: ${m.text()}`);
  });
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 500) problems.push(`API ${r.status()}: ${r.request().method()} ${new URL(r.url()).pathname}`);
  });
  return problems;
}

/**
 * Yerleşim hataları:
 * - ekran dışına taşan öğe (bilinçli yatay kaydırma kabı içinde değilse),
 * - `overflow: hidden` bir üst kap tarafından sağdan/soldan kırpılan öğe (içerik görünmez olur).
 * Bilinçli yatay kaydırma (overflow-x: auto/scroll — geniş tablolar, filtre şeritleri) serbesttir.
 */
export async function overflowReport(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    const name = (el: Element) =>
      `${el.tagName.toLowerCase()}${typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 4).join(".") : ""}`;
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const st = getComputedStyle(el);
      if (st.position === "fixed" || st.visibility === "hidden" || el.closest("[aria-hidden='true'],.sr-only")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      // İlk yatay kesici üst kap: kaydırılabilir ise sorun yok, gizliyorsa kırpılma
      let clipped = false;
      let inScroller = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "visible") continue;
        if (ox === "auto" || ox === "scroll") {
          inScroller = true;
          break;
        }
        const pr = p.getBoundingClientRect();
        if (r.right > pr.right + 1 || r.left < pr.left - 1) clipped = true;
        break;
      }
      if (clipped) out.push(`kırpılıyor: ${name(el)} [${Math.round(r.left)}–${Math.round(r.right)}]`);
      else if (!inScroller && (r.right > vw + 1 || r.left < -1)) out.push(`ekran dışı: ${name(el)} [${Math.round(r.left)}–${Math.round(r.right)} / ${vw}]`);
    }
    return { pageWidth: document.documentElement.scrollWidth, viewport: vw, offenders: [...new Set(out)].slice(0, 15) };
  });
}
