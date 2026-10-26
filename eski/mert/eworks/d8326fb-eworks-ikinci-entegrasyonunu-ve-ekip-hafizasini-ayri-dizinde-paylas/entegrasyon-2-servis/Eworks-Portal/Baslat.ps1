$packageRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
& (Join-Path $packageRoot 'Baslat.ps1')
