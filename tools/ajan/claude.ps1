# Claude kullananlar için: ekip değişikliklerini al (guncelle) veya bitirdiğin işi tamamlat (bitir).
# Kullanım (depo kökünden): powershell -ExecutionPolicy Bypass -File tools\ajan\claude.ps1 [-Mod guncelle|bitir] [-Yeni] [-Ajan]
#   -Yeni: "bitir"de istemi panoya kopyalamak yerine yeni oturum başlatır.  -Ajan: çıktı ajana talimattır (kanca / AGENTS.md).
# Mac/Linux: tools/ajan/claude.sh
param([ValidateSet('guncelle', 'bitir')][string]$Mod, [switch]$Yeni, [switch]$Ajan)
. (Join-Path $PSScriptRoot 'sarmalayici.ps1')
Invoke-Sarmalayici 'claude' $Mod -Yeni:$Yeni -Ajan:$Ajan
