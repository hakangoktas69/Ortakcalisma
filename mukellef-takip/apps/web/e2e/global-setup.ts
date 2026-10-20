import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { FullConfig } from "@playwright/test";

// Demo kullanıcısıyla bir kez giriş yapar; oturum bütün testlerde kullanılır (giriş akışının kendisi ayrı testte).
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  // Yığın yeni açıldıysa API hazır olana kadar bekle (en fazla 3 dk)
  for (let i = 0; i < 90; i++) {
    const ok = await fetch(`${baseURL}/api/health`).then((r) => r.ok).catch(() => false);
    if (ok) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  const res = await fetch(`${baseURL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.UI_EMAIL ?? "demo@mukellef.test", password: process.env.UI_PASSWORD ?? "Demo1234!" }),
  });
  if (!res.ok) throw new Error(`Demo girişi başarısız (${res.status}). Yığın açık mı? ${baseURL}`);
  const { accessToken } = (await res.json()) as { accessToken: string };
  const file = "./test-results/.auth/demo.json";
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ cookies: [], origins: [{ origin: new URL(baseURL).origin, localStorage: [{ name: "mt_token", value: accessToken }] }] }));
}
