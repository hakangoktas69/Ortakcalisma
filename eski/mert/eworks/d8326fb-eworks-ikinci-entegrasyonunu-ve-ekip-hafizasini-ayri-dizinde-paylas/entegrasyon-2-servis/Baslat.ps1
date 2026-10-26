param([string]$Python = "python", [string]$OcrPython)
$packageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if ($OcrPython) { $env:EWORKS_OCR_PYTHON = $OcrPython }
& $Python (Join-Path $packageRoot 'Eworks-Portal/yerel-sunucu.py')
