# Claude Code kullananlar için: ekip değişikliklerini al (guncelle) veya bitirdiğin işi tamamlat (bitir).
# Kullanım: powershell -ExecutionPolicy Bypass -File eski\hakan\mukellef-takip\tools\ajan\claude.ps1 [-Mod guncelle|bitir] [-Yeni]
#   -Yeni: "bitir"de istemi panoya kopyalamak yerine yeni oturum başlatır (işin yapıldığı oturumda vermek daha iyidir).
#   -Ajan: Claude'un kendisi çalıştırır (SessionStart ve Stop kancaları); çıktı Claude'a talimattır.

param(
  [ValidateSet('guncelle', 'bitir')][string]$Mod,
  [switch]$Yeni,
  [switch]$Ajan
)

. (Join-Path $PSScriptRoot 'ortak.ps1')

$EklentiNotu = 'VS Code eklentisinde yeni oturum açın (mukellef-takip ya da depo kökünde) ve yapıştırın.'
if ($Ajan -and -not $Mod) { throw '-Ajan ile -Mod verilmeli.' }
$Mod = Select-Mod $Mod

if ($Mod -eq 'guncelle') {
  if ($Ajan) { Invoke-AjanGuncelle 'eski\hakan\mukellef-takip\tools\ajan\claude.ps1'; return }
  $aralik = Invoke-Cek
  if (-not $aralik) { return }
  # SessionStart kancası ekip hafızasındaki son değişiklikleri zaten bildirir; istem belge değişikliklerini özetletir
  $istem = Join-Istem @(
    "Ekipten yeni değişiklikler geldi (git aralığı $aralik)."
    "git log ve git diff ile bu aralıkta CLAUDE.md, AGENTS.md, apps/*/CLAUDE.md, docs/ai, docs/adr, docs/02-baglamlar ve docs/ai/memory içinde neyin değiştiğini incele."
    'Mimari, kural ve süreç değişikliklerini 5 maddede özetle; bundan sonraki işlerde bu güncel hallerine uy.'
  )
  Start-Ajan 'claude' $istem $EklentiNotu
} else {
  $istem = Join-Istem @(
    'Bu işte yaptığın değişiklikleri git status ve git diff ile gözden geçir.'
    'Değişiklik mimariyi, bir kuralı, ucu, olayı, bağlam sınırını veya teknoloji kararını etkilediyse CLAUDE.md / apps/*/CLAUDE.md, docs/ai/*.md, gerekirse docs/adr ve docs/02-baglamlar sayfasını, durum değiştiyse docs/ai/roadmap.md dosyasını aynı değişiklikte güncelle.'
    'Kodda görünmeyen öğrenilmiş bir bilgi varsa /hafiza ile ekip hafızasına yaz.'
    'Ardından docs/ai/testing.md içindeki Bir işi tamamlarken adımlarını uygula: testleri ekle veya revize et, npm run memory:check ve npm run verify çalıştır, arayüz değiştiyse npm run test:ui.'
    'Koşulamayan adımı açıkça söyle. Sonunda neleri güncellediğini listele ve değişiklikleri commitle.'
  )
  if ($Ajan) { Write-Output $istem; return }
  if ($Yeni) { Start-Ajan 'claude' $istem $EklentiNotu } else { Copy-Istem $istem 'İşi yaptığınız Claude oturumuna yapıştırın.' }
  Write-Sonrasi
}
