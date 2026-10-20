#!/bin/sh
# Belirli aralıklarla tam veritabanı yedeği alır, AES-256 ile şifreler ve eski yedekleri siler.
# Yedekler kişisel veri içerir: /backups dizini kurum dışına (off-site) yalnız şifreli hâliyle taşınır.
# Geri yükleme: README "Yedekten geri yükleme".
set -eu

PGPASSWORD="$(cat /run/secrets/owner_password)"
export PGPASSWORD
INTERVAL=$(( ${BACKUP_INTERVAL_HOURS:-24} * 3600 ))
RETENTION=${BACKUP_RETENTION_DAYS:-14}

while true; do
  STAMP=$(date -u +%Y%m%dT%H%M%SZ)
  OUT="/backups/mukellef-$STAMP.dump.enc"
  if pg_dump --format=custom --no-owner --no-privileges | \
     openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass file:/run/secrets/backup_passphrase -out "$OUT.tmp"; then
    mv "$OUT.tmp" "$OUT"
    echo "$(date -u +%FT%TZ) yedek tamam: $(basename "$OUT") ($(du -h "$OUT" | cut -f1))"
  else
    rm -f "$OUT.tmp"
    echo "$(date -u +%FT%TZ) YEDEK BAŞARISIZ" >&2
  fi
  find /backups -name 'mukellef-*.dump.enc' -mtime +"$RETENTION" -delete
  sleep "$INTERVAL"
done
