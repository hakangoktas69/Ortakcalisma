export type ThemePref = "light" | "dark" | "system";

const KEY = "mt_theme";

/** Varsayılan açık tema; koyu veya "sisteme uy" sadece kullanıcı seçerse */
export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "system" ? v : "light";
  } catch {
    return "light";
  }
}

/** Tercihi kaydeder ve <html class="dark"> sınıfını hemen uygular (kök düzendeki başlangıç betiğiyle aynı kural). */
export function applyThemePref(pref: ThemePref) {
  try {
    if (pref === "light") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // Depolama kapalıysa tercih sadece bu oturumda geçerli olur
  }
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}
