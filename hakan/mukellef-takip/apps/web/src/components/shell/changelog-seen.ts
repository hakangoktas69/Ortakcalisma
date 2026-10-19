"use client";

import { useSyncExternalStore } from "react";
import { LATEST_CHANGE_ID } from "@/content/changelog";

// Kullanıcının gördüğü en yeni "Yenilikler" kaydı bu tarayıcıda tutulur
const KEY = "mt_changelog_seen";
const listeners = new Set<() => void>();

function read() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return LATEST_CHANGE_ID; // depolama kapalıysa işaret gösterilmez
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** Okunmamış yenilik var mı? (sunucuda her zaman hayır; işaret sadece tarayıcıda yanar) */
export function useHasUnseenChanges() {
  return useSyncExternalStore(subscribe, () => read() !== LATEST_CHANGE_ID, () => false);
}

export function markChangesSeen() {
  try {
    localStorage.setItem(KEY, LATEST_CHANGE_ID);
  } catch {
    // Depolama kapalıysa sadece bu oturum için
  }
  listeners.forEach((l) => l());
}
