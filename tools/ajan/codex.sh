#!/bin/sh
# Codex kullananlar için (Mac/Linux): ./tools/ajan/codex.sh guncelle|bitir [--ajan]
#   guncelle: git pull + yeni oturum istemi (çıktı)  ·  bitir: iş bitirme adımları (oturuma yapıştırın)
#   --ajan: çıktı ajana talimattır (kanca / AGENTS.md). Asıl iş: tools/ajan/{guncelle,bitir}.mjs
dir=$(dirname "$0")
mod=${1:-guncelle}
case "$mod" in guncelle|bitir) ;; *) echo "Kullanım: $0 guncelle|bitir [--ajan]" >&2; exit 2 ;; esac
if [ "$2" = "--ajan" ] || [ "$mod" = "bitir" ]; then exec node "$dir/$mod.mjs" --ajan codex; fi
istem=$(node "$dir/guncelle.mjs" --ajan codex --cek) || exit 1
[ -z "$istem" ] && exit 0
if command -v codex >/dev/null 2>&1; then exec codex "$istem"; fi
printf '\nYeni %s oturumuna yapıştırın:\n\n%s\n' "codex" "$istem"
