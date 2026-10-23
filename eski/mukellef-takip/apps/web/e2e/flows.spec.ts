import { expect, test } from "@playwright/test";
import { watch } from "./support";

// Kullanıcı akışları, her ekran boyutunda: giriş, hatalı şifre, menüyle gezinme, arama paleti, çıkış.

test.describe("giriş", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("oturumsuz kullanıcı giriş ekranına yönlenir; hatalı şifre mesajı; doğru şifreyle iş kutusu", async ({ page }) => {
    const problems = watch(page);
    await page.goto("/firmalar");
    await expect(page).toHaveURL(/\/login/);
    await page.locator('input[type="email"]').fill("demo@mukellef.test");
    await page.locator('input[type="password"]').fill("yanlis-sifre");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await expect(page.getByText(/hatalı/i)).toBeVisible();
    await page.locator('input[type="password"]').fill("Demo1234!");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(/açık iş/)).toBeVisible();
    // Hatalı giriş beklenen 401'dir; çalışma anı hatası olmamalı
    expect(problems).toEqual([]);
  });
});

test("ana menüyle gezinme (telefonda çekmece, büyük ekranda yan menü)", async ({ page }, info) => {
  const problems = watch(page);
  await page.goto("/");
  if (info.project.name === "telefon") {
    await page.getByRole("button", { name: "Menüyü aç" }).click();
    const drawer = page.getByRole("dialog", { name: "Menü" });
    await expect(drawer).toBeVisible();
    await drawer.getByRole("link", { name: /Mükellefler|Firmalar/ }).first().click();
    await expect(drawer).toBeHidden();
  } else {
    await page.getByRole("navigation", { name: "Ana menü" }).getByRole("link", { name: /Mükellefler|Firmalar/ }).first().click();
  }
  await expect(page).toHaveURL(/\/firmalar/);
  await expect(page.locator("main table, main [role='table'], main ul").first()).toBeVisible();
  expect(problems).toEqual([]);
});

test("arama paleti mükellef bulur ve açar", async ({ page }) => {
  const problems = watch(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Ara" }).click();
  const input = page.getByRole("dialog").locator("input").first();
  await expect(input).toBeVisible();
  await input.fill("Ltd");
  await expect(page.getByRole("dialog").getByText(/Ltd/).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(problems).toEqual([]);
});

test("çıkış oturumu kapatır", async ({ page }, info) => {
  await page.goto("/");
  if (info.project.name === "telefon") {
    await page.getByRole("button", { name: "Menüyü aç" }).click();
    await page.getByRole("dialog", { name: "Menü" }).getByRole("button", { name: "Çıkış yap" }).click();
  } else {
    await page.getByRole("button", { name: "Hesap menüsü" }).click();
    await page.getByRole("menuitem", { name: "Çıkış yap" }).click();
  }
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/firmalar");
  await expect(page).toHaveURL(/\/login/);
});
