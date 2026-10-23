# Eworks portalını ve yerel Supabase'i durdurur. Veriler korunur
# (silmek için: docker compose down; npx supabase stop --no-backup).
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
docker compose down
npx -y supabase@2.121.0 stop
