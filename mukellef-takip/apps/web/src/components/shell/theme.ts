export type ThemePref = "light" | "dark" | "system";

const KEY = "mt_theme";

/** Varsayılan koyu tema; açık veya "sisteme uy" için kullanıcı seçimi saklanır */
export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "system" ? v : "dark";
  } catch {
    return "dark";
  }
}

/** Tercihi kaydeder ve <html class="dark"> sınıfını hemen uygular (kök düzendeki başlangıç betiğiyle aynı kural). */
export function applyThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    // Depolama kapalıysa tercih sadece bu oturumda geçerli olur
  }
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}
