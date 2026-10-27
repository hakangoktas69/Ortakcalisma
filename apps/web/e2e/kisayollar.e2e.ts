import { expect, test } from '@playwright/test';
import { ekranDenetle, girisYap, hataTopla, kullanicilar } from './yardim.ts';

// Portal kısayolları (workspace): Günlük Yönetim'den açılır; GİB ve SGK resmî giriş sayfaları yeni sekmede, kimlik bilgisi aktarılmadan.

test.describe('portal kısayolları', () => {
  test('@F:kisayollar.view personel Günlük Yönetim\'den kısayolları açar; bağlantılar resmî sayfalara yeni sekmede gider', async ({ page }) => {
    const hatalar = hataTopla(page);
    await girisYap(page, kullanicilar().personel);
    await page.goto('/kategori/gunluk');
    await page.locator('[data-modul="kisayollar"]').click();
    await expect(page).toHaveURL(/\/kisayollar$/);
    await expect(page.getByRole('heading', { level: 1, name: /Portal kısayolları/ })).toBeVisible();
    const gib = page.getByRole('region', { name: 'GİB' });
    const sgk = page.getByRole('region', { name: 'SGK' });
    const dvd = gib.getByRole('link', { name: /Dijital Vergi Dairesi sayfasını aç/ });
    await expect(dvd).toHaveAttribute('href', 'https://dijital.gib.gov.tr/portal/login');
    await expect(dvd).toHaveAttribute('target', '_blank');
    await expect(dvd).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(sgk.getByRole('link', { name: /SGK e-Bildirge V2 sayfasını aç/ })).toHaveAttribute('href', 'https://ebildirge.sgk.gov.tr/EBildirgeV2');
    for (const href of await page.locator('main a[target="_blank"]').evaluateAll((a) => a.map((x) => (x as HTMLAnchorElement).href))) {
      expect(new URL(href).hostname).toMatch(/\.gov\.tr$/);
    }
    await ekranDenetle(page);
    expect(hatalar).toEqual([]);
  });
});
