$portalRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$portalPython = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe'
if (!(Test-Path -LiteralPath $portalPython)) { throw 'Python yolu bulunamadi. yerel-sunucu.py dosyasini Python 3.11+ ile calistirin.' }
try { $portalResponse = Invoke-WebRequest 'http://127.0.0.1:8765/eworks-tasarim.html' -TimeoutSec 2 -UseBasicParsing } catch { $portalResponse = $null }
if (!$portalResponse) {
    Start-Process -FilePath $portalPython -ArgumentList ('"' + (Join-Path $portalRoot 'yerel-sunucu.py') + '"') -WorkingDirectory $portalRoot -WindowStyle Hidden
    Start-Sleep -Seconds 2
}
Start-Process 'http://127.0.0.1:8765/eworks-tasarim.html'
