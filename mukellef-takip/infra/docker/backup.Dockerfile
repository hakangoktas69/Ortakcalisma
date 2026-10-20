# Şifreli PostgreSQL yedeği (pg_dump + AES-256, parola Docker secret'tan). Bkz. backup/backup.sh
FROM postgres:17.11-alpine
RUN apk add --no-cache openssl tini
COPY backup/backup.sh /usr/local/bin/backup.sh
RUN chmod 0555 /usr/local/bin/backup.sh
USER postgres
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/usr/local/bin/backup.sh"]
