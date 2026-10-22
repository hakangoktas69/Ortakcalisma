# claude.ps1 ve codex.ps1'in ortak adımları; doğrudan çalıştırılmaz (dot-source edilir).
# Windows PowerShell 5.1 uyumlu. Dosya UTF-8 BOM'lu kaydedilmeli, yoksa 5.1 Türkçe karakterleri bozar.

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$ProjeDizini = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

# Ajanların bağlamını oluşturan dosyalar (mukellef-takip'e göre)
$BaglamYollari = @('CLAUDE.md', 'AGENTS.md', 'apps/*/CLAUDE.md', 'docs/ai', 'docs/adr', 'docs/02-baglamlar', '../CLAUDE.md', '../AGENTS.md')

function Select-Mod([string]$Mod) {
  if ($Mod) { return $Mod }
  Write-Host ''
  Write-Host '  1) guncelle  - ekipten gelen değişiklikleri çek, ajanı yeni bağlamla başlat'
  Write-Host '  2) bitir     - bitirdiğim işin belgelerini, hafızasını ve testlerini tamamlat'
  $secim = Read-Host 'Seçim (1/2)'
  if ($secim -eq '2' -or $secim -eq 'bitir') { return 'bitir' }
  return 'guncelle'
}

# git pull yapar; yeni commit geldiyse "eski..yeni" aralığını, gelmediyse $null döner
function Invoke-Cek {
  Set-Location $ProjeDizini
  $once = (git rev-parse HEAD).Trim()
  Write-Host '> git pull' -ForegroundColor Cyan
  git pull | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'git pull başarısız. Yerel değişiklikleri commitleyin veya çakışmayı çözün, sonra tekrar çalıştırın.' }
  $sonra = (git rev-parse HEAD).Trim()
  if ($once -eq $sonra) {
    Write-Host 'Yeni değişiklik yok; bağlamınız güncel.' -ForegroundColor Green
    return $null
  }
  Write-Host ''
  Write-Host 'Gelen commitler:' -ForegroundColor Cyan
  git log --oneline "$once..$sonra" | Out-Host
  Write-Host 'Ajan bağlamında değişen dosyalar:' -ForegroundColor Cyan
  $bagliDegisim = git diff --stat $once $sonra -- $BaglamYollari
  if ($bagliDegisim) { $bagliDegisim | Out-Host } else { Write-Host '  (yok; yalnız kod değişmiş)' }
  return "$once..$sonra"
}

# -Ajan modu: ajanın kendisi (kanca ya da AGENTS.md talimatı) çalıştırır; oturum başlatmaz, çıktısı ajana talimattır.
# Yalnız güvenliyse ileri sarar (çalışma ağacı temiz, dal ayrışmamış); değilse kullanıcıya haber verdirir.
function Invoke-AjanGuncelle([string]$Betik) {
  $ErrorActionPreference = 'Continue'  # 5.1'de 2>$null, Stop altında hata kaydına dönüşür
  Set-Location $ProjeDizini
  $ust = git rev-parse --abbrev-ref '@{u}' 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $ust) { return }
  git fetch --quiet 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Output "Ekip senkronu: git fetch yapılamadı (ağ ya da izin yok); ekipten gelen değişiklikler denetlenmedi. Kullanıcıya bir kez söyle ve '$Betik -Mod guncelle' çalıştırmasını öner."
    return
  }
  $geride = [int](git rev-list --count 'HEAD..@{u}')
  if ($geride -eq 0) { return }
  $ileride = [int](git rev-list --count '@{u}..HEAD')
  $kirli = git status --porcelain --untracked-files=no
  $once = (git rev-parse HEAD).Trim()
  if ($ileride -eq 0 -and -not $kirli) { git merge --ff-only --quiet '@{u}' 2>$null | Out-Null }
  $sonra = (git rev-parse HEAD).Trim()
  if ($once -eq $sonra) {
    Write-Output "Ekip senkronu: $ust dalında $geride yeni commit var ama otomatik ileri sarılamadı (commitlenmemiş değişiklik ya da ayrışmış dal). Kullanıcıya bunu bir kez söyle ve '$Betik -Mod guncelle' çalıştırmasını öner; kendiliğinden pull/merge yapma."
    return
  }
  Write-Output "Ekip senkronu: $ust dalından $geride commit ileri sarıldı ($once..$sonra):"
  git log --oneline "$once..$sonra"
  $bagliDegisim = git diff --name-only $once $sonra -- $BaglamYollari
  if ($bagliDegisim) {
    Write-Output 'Değişen bağlam dosyaları (oturum başında yüklenen sürümleri eskidi; bunları şimdi oku ve yeni hallerine uy):'
    $bagliDegisim
  }
  Write-Output 'Kullanıcıya gelen değişiklikleri (mimari, kural, süreç, ekip hafızası) en fazla 5 maddede özetle.'
}

# Ajanı istemle başlatır; komut satırı aracı yoksa istemi panoya kopyalar (VS Code eklentisi kullananlar için)
function Start-Ajan([string]$Komut, [string]$Istem, [string]$EklentiNotu) {
  Set-Location $ProjeDizini
  if (Get-Command $Komut -ErrorAction SilentlyContinue) {
    Write-Host "> $Komut (yeni oturum, $ProjeDizini)" -ForegroundColor Cyan
    & $Komut $Istem
  } else {
    Set-Clipboard -Value $Istem
    Write-Host ''
    Write-Host "'$Komut' komut satırında bulunamadı. İstem panoya kopyalandı:" -ForegroundColor Yellow
    Write-Host $EklentiNotu -ForegroundColor Yellow
    Write-Host ''
    Write-Host $Istem
  }
}

function Copy-Istem([string]$Istem, [string]$Not) {
  Set-Clipboard -Value $Istem
  Write-Host ''
  Write-Host "İstem panoya kopyalandı. $Not" -ForegroundColor Yellow
  Write-Host ''
  Write-Host $Istem
}

function Write-Sonrasi {
  Write-Host ''
  Write-Host 'Ajan işi bitirince:' -ForegroundColor Cyan
  Write-Host '  1. Değişiklikleri gözden geçirin (git show / git diff); kod mimariyi değiştirdiyse docs/ai ve ADR de değişmiş olmalı.'
  Write-Host '  2. git push, ardından PR açın.'
  Write-Host '  3. Ekibe haber verin: diğerleri kendi betiğini "guncelle" ile çalıştırır.'
}

# İstemler tek satırdır: npm ile kurulan .cmd sarmalayıcıları çok satırlı argümanı bozar
function Join-Istem([string[]]$Cumleler) { return ($Cumleler -join ' ') }
