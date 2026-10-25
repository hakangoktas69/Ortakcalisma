-- Supabase servis rollerinin parolası (resmî self-hosted kurulumdaki roles.sql karşılığı); değer ortamdan okunur.
\set pgpass `echo "$POSTGRES_PASSWORD"`
alter user supabase_auth_admin with password :'pgpass';
