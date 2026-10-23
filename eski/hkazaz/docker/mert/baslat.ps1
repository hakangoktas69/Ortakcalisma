# Eworks (mert) uygulamasını Docker'da başlatır:
#   1) mert/eworks SQL ve Edge Function kaynaklarını yerel Supabase klasörüne kopyalar
#   2) Yerel Supabase'i (Auth, PostgREST, Vault, Edge Functions, Studio) Docker'da açar
#   3) Demo portal kullanıcısını oluşturur
#   4) Portal container'ını derleyip başlatır
# Gereken: Docker Desktop açık, Node.js (npx). İlk çalıştırma Supabase imajlarını indirir (birkaç GB).
# npx ilerleme mesajlarını stderr'e yazar; hata kontrolü $LASTEXITCODE ile yapılır
$ErrorActionPreference = 'Continue'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$eworks = Resolve-Path (Join-Path $here '..\..\..\mert\eworks')
Set-Location $here

$demoEmail = 'demo@eworks.test'
$demoPassword = 'Demo1234!eworks'

# 1) Kaynakları kopyala (mert/eworks değiştirilmez). Firma bazlı Vault SQL'i test edilmemiş taslak olduğu için alınmaz.
$migrations = Join-Path $here 'supabase\migrations'
$function = Join-Path $here 'supabase\functions\gib-account'
New-Item -ItemType Directory -Force $migrations, $function | Out-Null
Copy-Item (Join-Path $eworks 'Eworks-Portal\supabase-kurulum.sql') (Join-Path $migrations '20261019000001_eworks_kurulum.sql') -Force
Copy-Item (Join-Path $eworks 'Eworks-Portal\supabase-gib-vault.sql') (Join-Path $migrations '20261019000002_eworks_gib_vault.sql') -Force
Copy-Item (Join-Path $eworks 'Eworks-Portal\supabase\functions\gib-account\index.ts') (Join-Path $function 'index.ts') -Force

# 2) Yerel Supabase
# Eworks yalnızca Auth, REST (PostgREST), Vault ve Edge Functions kullanır; diğer servisler açılmaz
npx -y supabase@2.121.0 start -x realtime,storage-api,imgproxy,mailpit,logflare,vector,supavisor
if ($LASTEXITCODE -ne 0) { throw 'Supabase başlatılamadı' }
$status = (npx -y supabase@2.121.0 status -o json 2>$null) -join "`n" | ConvertFrom-Json
$anonKey = $status.ANON_KEY
$serviceKey = $status.SERVICE_ROLE_KEY
if (-not $anonKey -or -not $serviceKey) { throw 'Supabase anahtarları okunamadı' }

# 3) Demo kullanıcı (varsa hata yok sayılır)
$body = @{ email = $demoEmail; password = $demoPassword; email_confirm = $true } | ConvertTo-Json
try {
    Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:55321/auth/v1/admin/users' -ContentType 'application/json' -Body $body `
        -Headers @{ apikey = $serviceKey; Authorization = "Bearer $serviceKey" } | Out-Null
    Write-Host "Demo kullanıcı oluşturuldu."
} catch { Write-Host "Demo kullanıcı zaten var." }

# 4) Portal
"SUPABASE_KEY=$anonKey" | Out-File -Encoding ascii (Join-Path $here '.env')
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { throw 'Portal container başlatılamadı' }

Write-Host ""
Write-Host "Eworks portal : http://127.0.0.1:8765/eworks-tasarim.html"
Write-Host "Giriş         : $demoEmail / $demoPassword"
Write-Host "Supabase Studio: http://127.0.0.1:55323"
Start-Process 'http://127.0.0.1:8765/eworks-tasarim.html'
