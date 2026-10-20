import { expect, test } from "@playwright/test";
import { PANEL_ROUTES, overflowReport, watch } from "./support";

// Her panel sayfası her ekran boyutunda: çalışma anı hatası yok, API 5xx yok, yatay taşma yok, içerik görünür.
// Taşma kuralı: sayfa genişliği ekranı aşmaz; geniş tablolar kendi kaydırma kabında (overflow-x-auto) kalır.

for (const route of PANEL_ROUTES) {
  test(`${route.name} (${route.path})`, async ({ page }, info) => {
    const problems = watch(page);
    await page.goto(route.path);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main")).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);

    const o = await overflowReport(page);
    await page.screenshot({ path: info.outputPath(`${route.path.replace(/\W+/g, "_") || "root"}.png`), fullPage: true });
    expect(problems, problems.join("\n")).toEqual([]);
    expect(o.pageWidth, `Sayfa ekrandan geniş (${o.pageWidth} > ${o.viewport}). Taşan öğeler:\n${o.offenders.join("\n")}`).toBeLessThanOrEqual(o.viewport + 1);
    expect(o.offenders, `Ekran dışına taşan öğeler:\n${o.offenders.join("\n")}`).toEqual([]);
  });
}
