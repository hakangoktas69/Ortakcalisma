import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NAV, isActivePath } from "@/components/shell/nav";
import { CHANGELOG, LATEST_CHANGE_ID } from "./changelog";
import { FAQ } from "./faq";

// Kodla sürümlenen içerik ve menü tutarlılığı: bozuk bağlantı, tekrar eden kimlik, sırasız sürüm notu yakalanır.

const appDir = join(__dirname, "..", "app");
const routeExists = (href: string) => {
  const path = href.split(/[?#]/)[0];
  if (path === "/") return existsSync(join(appDir, "(panel)", "page.tsx"));
  return existsSync(join(appDir, "(panel)", path, "page.tsx")) || existsSync(join(appDir, path, "page.tsx"));
};

describe("Yenilikler (changelog)", () => {
  it("kimlikler benzersiz, tarihler yeniden eskiye, en yeni kayıt işaretçisi doğru", () => {
    const ids = CHANGELOG.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const dates = CHANGELOG.map((c) => c.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(LATEST_CHANGE_ID).toBe(CHANGELOG[0].id);
    for (const c of CHANGELOG) {
      expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.changes.length).toBeGreaterThan(0);
    }
  });

  it("bağlantılar var olan sayfalara gider", () => {
    for (const c of CHANGELOG) for (const ch of c.changes) if (ch.href) expect(routeExists(ch.href), `${c.id}: ${ch.href}`).toBe(true);
  });
});

describe("SSS", () => {
  it("soru kimlikleri benzersiz (/sss#kimlik bağlantıları kırılmasın)", () => {
    const ids = FAQ.flatMap((s) => s.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of FAQ) expect(s.items.length).toBeGreaterThan(0);
  });
});

describe("menü", () => {
  it("bütün menü bağlantıları var olan sayfalara gider", () => {
    for (const g of NAV) for (const i of g.items) expect(routeExists(i.href), i.href).toBe(true);
  });

  it("etkin sayfa eşleşmesi: kök yalnız kendisi, alt yollar üst menüyü işaretler", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/", "/firmalar")).toBe(false);
    expect(isActivePath("/firmalar", "/firmalar")).toBe(true);
    expect(isActivePath("/firmalar", "/firmalar/123")).toBe(true);
    expect(isActivePath("/firma", "/firmalar")).toBe(false);
  });
});
