# Codex kullananlar için: ekip değişikliklerini al (guncelle) veya bitirdiğin işi tamamlat (bitir).
# Kullanım: powershell -ExecutionPolicy Bypass -File eski\hakan\mukellef-takip\tools\ajan\codex.ps1 [-Mod guncelle|bitir] [-Yeni]
#   -Yeni: "bitir"de istemi panoya kopyalamak yerine yeni oturum başlatır (işin yapıldığı oturumda vermek daha iyidir).
#   -Ajan: Codex'in kendisi çalıştırır (AGENTS.md talimatı); çıktı Codex'e talimattır.

param(
  [ValidateSet('guncelle', 'bitir')][string]$Mod,
  [switch]$Yeni,
  [switch]$Ajan
)

. (Join-Path $PSScriptRoot 'ortak.ps1')

$EklentiNotu = 'Codex eklentisinde/uygulamasında mukellef-takip dizininde yeni oturum açın ve yapıştırın.'
if ($Ajan -and -not $Mod) { throw '-Ajan ile -Mod verilmeli.' }
$Mod = Select-Mod $Mod

if ($Mod -eq 'guncelle') {
  if ($Ajan) { Invoke-AjanGuncelle 'eski\hakan\mukellef-takip\tools\ajan\codex.ps1'; return }
  $aralik = Invoke-Cek
  if (-not $aralik) { return }
  # Codex'te SessionStart kancası yok: hafıza değişikliklerini de istem okutur
  $istem = Join-Istem @(
    'AGENTS.md içindeki Oturum başında adımlarını uygula.'
    "Ekipten yeni değişiklikler geldi (git aralığı $aralik)."
    "git log ve git diff ile bu aralıkta CLAUDE.md, AGENTS.md, apps/*/CLAUDE.md, docs/ai, docs/adr, docs/02-baglamlar ve docs/ai/memory içinde neyin değiştiğini incele."
    'Mimari, kural, süreç ve ekip hafızası değişikliklerini 5 maddede özetle; bundan sonraki işlerde bu güncel hallerine uy.'
  )
  Start-Ajan 'codex' $istem $EklentiNotu
} else {
  $istem = Join-Istem @(
    'Bu işte yaptığın değişiklikleri git status ve git diff ile gözden geçir.'
    'AGENTS.md içindeki İşi bitirmeden önce adımlarını uygula: değişiklik mimariyi, bir kuralı, ucu, olayı, bağlam sınırını veya teknoloji kararını etkilediyse kaynak belgeleri (CLAUDE.md, apps/*/CLAUDE.md, docs/ai, docs/adr, docs/02-baglamlar, roadmap) güncelle.'
    'Kodda görünmeyen öğrenilmiş bilgi varsa docs/ai/memory altına AGENTS.md içindeki biçimle yaz ve MEMORY.md dosyasına tek satır ekle.'
    'Testleri ekle veya revize et; npm run memory:check ve npm run verify çalıştır, arayüz değiştiyse npm run test:ui.'
    'Koşulamayan adımı açıkça söyle. Sonunda neleri güncellediğini listele ve değişiklikleri commitle.'
  )
  if ($Ajan) { Write-Output $istem; return }
  if ($Yeni) { Start-Ajan 'codex' $istem $EklentiNotu } else { Copy-Istem $istem 'İşi yaptığınız Codex oturumuna yapıştırın.' }
  Write-Sonrasi
}
