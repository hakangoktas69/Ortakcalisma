# claude.ps1 ve codex.ps1'in ortak gövdesi (dot-source edilir). Asıl iş Node betiklerindedir (guncelle.mjs, bitir.mjs);
# bu dosya yalnız istemi ajana verir ya da panoya kopyalar. Windows PowerShell 5.1 uyumlu; UTF-8 BOM'lu kaydedilmeli.

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$ProjeDizini = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Invoke-Sarmalayici([string]$Arac, [string]$Mod, [switch]$Yeni, [switch]$Ajan) {
  Set-Location $ProjeDizini
  if (-not $Mod) {
    Write-Host '  1) guncelle  - ekipten gelen değişiklikleri çek, ajanı yeni bağlamla başlat'
    Write-Host '  2) bitir     - bitirdiğim işin belgelerini, hafızasını, senkronunu ve testlerini tamamlat'
    $Mod = if ((Read-Host 'Seçim (1/2)') -in @('2', 'bitir')) { 'bitir' } else { 'guncelle' }
  }
  $betik = Join-Path $PSScriptRoot "$Mod.mjs"
  if ($Ajan) { & node $betik --ajan $Arac; return }
  if ($Mod -eq 'guncelle') {
    $istem = (& node $betik --ajan $Arac --cek) -join ' '
    if ($LASTEXITCODE -ne 0 -or -not $istem) { return }
    $Yeni = $true
  } else {
    $istem = (& node $betik --ajan $Arac) -join "`n"
  }
  if ($Yeni -and (Get-Command $Arac -ErrorAction SilentlyContinue)) {
    Write-Host "> $Arac (yeni oturum, $ProjeDizini)" -ForegroundColor Cyan
    & $Arac ($istem -replace "`n", ' ')
  } else {
    Set-Clipboard -Value $istem
    Write-Host ''
    Write-Host "İstem panoya kopyalandı; $Arac oturumuna (VS Code eklentisi dahil) yapıştırın:" -ForegroundColor Yellow
    Write-Host ''
    Write-Host $istem
  }
}
