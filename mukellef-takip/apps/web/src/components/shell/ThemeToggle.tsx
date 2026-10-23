"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { applyThemePref, readThemePref, type ThemePref } from "./theme";

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function setTheme(pref: ThemePref) {
  applyThemePref(pref);
  listeners.forEach((l) => l());
}

export function useThemePref() {
  return useSyncExternalStore(subscribe, readThemePref, () => "light" as ThemePref);
}

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Açık", icon: Sun },
  { value: "system", label: "Sistem", icon: Monitor },
  { value: "dark", label: "Koyu", icon: Moon },
];

/** Açık / sistem / koyu tema seçici */
export function ThemeToggle() {
  const pref = useThemePref();
  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={pref === value}
          onClick={() => setTheme(value)}
          className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium ${
            pref === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Icon size={13} /> {label}
        </button>
      ))}
    </div>
  );
}
