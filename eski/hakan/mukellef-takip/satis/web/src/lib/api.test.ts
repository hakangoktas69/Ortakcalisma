import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";
import { actionLabel, daysLeft, formatDate, formatPhone } from "./format";

const reply = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);

describe("satış API istemcisi", () => {
  const assign = vi.fn();
  beforeEach(() => {
    assign.mockReset();
    Object.defineProperty(window, "location", { value: { pathname: "/satis", assign }, writable: true });
  });

  it("her isteğe CSRF başlığını ekler, çerezle gönderir ve anahtar saklamaz", async () => {
    const f = reply(200, { ok: true });
    vi.stubGlobal("fetch", f);
    await api("/offices", { body: { a: 1 } });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("/api/satis/offices");
    expect(init).toMatchObject({ method: "POST", credentials: "same-origin", body: '{"a":1}' });
    expect(init.headers["X-Satis"]).toBe("1");
    expect(localStorage.length).toBe(0);
  });

  it("oturum düşünce giriş ekranına yönlendirir", async () => {
    vi.stubGlobal("fetch", reply(401, { message: "Oturum açın" }));
    await expect(api("/offices")).rejects.toBeInstanceOf(ApiError);
    expect(assign).toHaveBeenCalledWith("/satis/giris");
  });

  it("giriş adımlarındaki 401'de yönlendirmez, mesajı gösterir", async () => {
    vi.stubGlobal("fetch", reply(401, { message: "E-posta veya şifre hatalı" }));
    await expect(api("/auth/login", { body: {} })).rejects.toThrow("E-posta veya şifre hatalı");
    expect(assign).not.toHaveBeenCalled();
  });

  it("geçici şifrede şifre değiştirme ekranına yönlendirir", async () => {
    vi.stubGlobal("fetch", reply(403, { code: "PASSWORD_CHANGE_REQUIRED", message: "x" }));
    await expect(api("/offices")).rejects.toMatchObject({ status: 403, code: "PASSWORD_CHANGE_REQUIRED" });
    expect(assign).toHaveBeenCalledWith("/satis/sifre");
  });

  it("doğrulama hatalarını birleştirir", async () => {
    vi.stubGlobal("fetch", reply(400, { message: ["a geçersiz", "b geçersiz"] }));
    await expect(api("/offices", { body: {} })).rejects.toThrow("a geçersiz, b geçersiz");
  });
});

describe("biçimlendirme", () => {
  it("telefon", () => {
    expect(formatPhone("905321234567")).toBe("+90 532 123 45 67");
    expect(formatPhone(null)).toBe("—");
    expect(formatPhone("123")).toBe("123");
  });
  it("tarih ve kalan gün", () => {
    expect(formatDate("2026-10-21T10:00:00Z")).toBe("21.10.2026");
    expect(formatDate(null)).toBe("—");
    const now = new Date("2026-10-21T10:00:00Z");
    expect(daysLeft("2026-10-31T10:00:00Z", now)).toBe(10);
    expect(daysLeft("2026-10-20T10:00:00Z", now)).toBe(-1);
    expect(daysLeft(null, now)).toBeNull();
  });
  it("işlem adları", () => {
    expect(actionLabel("sales.office.create")).toBe("Büro açıldı");
    expect(actionLabel("bilinmeyen")).toBe("bilinmeyen");
  });
});
