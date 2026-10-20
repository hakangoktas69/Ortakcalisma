import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, apiUpload, downloadFile, formatDate, getToken, setToken } from "./api";

// API istemcisi: oturum anahtarı, hata mesajları ve güvenlik yönlendirmeleri (401 / şifre / 2FA).

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

let location: { href: string; pathname: string };
beforeEach(() => {
  localStorage.clear();
  location = { href: "/", pathname: "/" };
  vi.stubGlobal("location", location);
});
afterEach(() => vi.unstubAllGlobals());

describe("oturum anahtarı", () => {
  it("yazılır, okunur ve silinir", () => {
    expect(getToken()).toBeNull();
    setToken("abc");
    expect(getToken()).toBe("abc");
    setToken(null);
    expect(getToken()).toBeNull();
  });
});

describe("api()", () => {
  it("Authorization başlığını ekler ve JSON döner", async () => {
    setToken("tkn");
    const fetchMock = vi.fn(async () => json(200, { ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await api("/companies")).toEqual({ ok: 1 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/companies$/);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tkn");
  });

  it("401'de oturumu siler ve giriş ekranına gönderir (giriş isteğinin kendisi hariç)", async () => {
    setToken("eski");
    vi.stubGlobal("fetch", async () => json(401, { message: "Oturum sona erdi" }));
    await expect(api("/companies")).rejects.toBeInstanceOf(ApiError);
    expect(getToken()).toBeNull();
    expect(location.href).toBe("/login");

    location.href = "/login";
    setToken("x");
    await expect(api("/auth/login", { method: "POST" })).rejects.toThrow("Oturum sona erdi");
    expect(getToken()).toBe("x");
  });

  it("geçici şifre ve 2FA zorunluluğunda ilgili ekrana yönlendirir", async () => {
    vi.stubGlobal("fetch", async () => json(403, { code: "PASSWORD_CHANGE_REQUIRED", message: "Şifre" }));
    await expect(api("/x")).rejects.toThrow();
    expect(location.href).toBe("/sifre-degistir");
    vi.stubGlobal("fetch", async () => json(403, { code: "TWO_FACTOR_REQUIRED", message: "2FA" }));
    await expect(api("/x")).rejects.toThrow();
    expect(location.href).toBe("/iki-adim");
  });

  it("doğrulama hatalarını tek mesajda birleştirir; gövdesiz hata genel mesaj verir", async () => {
    vi.stubGlobal("fetch", async () => json(400, { message: ["e-posta geçersiz", "şifre kısa"] }));
    await expect(api("/x")).rejects.toThrow("e-posta geçersiz, şifre kısa");
    vi.stubGlobal("fetch", async () => new Response("bozuk", { status: 500 }));
    const e = await api("/x").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(500);
    expect((e as ApiError).message).toBe("Bir hata oluştu");
  });
});

describe("dosya işlemleri", () => {
  it("indirme: dosya adını başlıktan alır", async () => {
    vi.stubGlobal("fetch", async () => new Response("a;b", { status: 200, headers: { "Content-Disposition": 'attachment; filename="rapor.csv"' } }));
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    expect(await downloadFile("/reports/firmalar")).toBe("rapor.csv");
  });

  it("yükleme: çok parçalı form, alanlar ve dosyalar gider", async () => {
    const fetchMock = vi.fn(async () => json(201, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await apiUpload("/invoices/import", "files", [new File(["<x/>"], "a.xml")], { companyId: "c1" });
    const body = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData;
    expect(body.get("companyId")).toBe("c1");
    expect((body.get("files") as File).name).toBe("a.xml");
  });
});

describe("biçimlendirme", () => {
  it("tarih Türkçe biçimde, boşsa tire", () => {
    expect(formatDate("2026-10-20T10:00:00.000Z")).toMatch(/20\.10\.2026/);
    expect(formatDate(null)).toBe("—");
  });
});
