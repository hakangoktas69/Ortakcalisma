#!/bin/sh
# İlk kurulumda (boş veri dizini) bir kez çalışır. Rol modeli (docs/adr/0004):
#   postgres        superuser — yalnız yönetim; uygulama kullanmaz
#   mukellef_owner  tabloların sahibi, migration ve yedek (BYPASSRLS: yedek ve bakım tüm büroları görür)
#   app_user        yetki rolü (NOLOGIN); RLS'e tabi
#   mukellef_app    API ve worker'ın giriş rolü, app_user üyesi; tablo sahibi değil, RLS'i atlayamaz
set -eu

OWNER_PASSWORD="$(cat /run/secrets/owner_password)"
APP_PASSWORD="$(cat /run/secrets/app_password)"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v owner_pw="$OWNER_PASSWORD" -v app_pw="$APP_PASSWORD" <<'SQL'
CREATE ROLE mukellef_owner LOGIN NOSUPERUSER NOCREATEROLE BYPASSRLS PASSWORD :'owner_pw';
CREATE ROLE app_user NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE mukellef_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD :'app_pw' IN ROLE app_user;

ALTER DATABASE mukellef OWNER TO mukellef_owner;
REVOKE ALL ON DATABASE mukellef FROM PUBLIC;
GRANT CONNECT ON DATABASE mukellef TO mukellef_owner, mukellef_app;
-- public şeması veritabanı sahibine ait (PG15+); diğer roller şemada nesne oluşturamaz
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
