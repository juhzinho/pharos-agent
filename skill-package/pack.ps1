# Regenera os ZIPs do pacote Skill (paths com / para compatibilidade com upload)
$src = Join-Path $PSScriptRoot "prospilot"
$nested = Join-Path $PSScriptRoot "prospilot.zip"
$flat = Join-Path $PSScriptRoot "prospilot-flat.zip"
# Legacy filenames (optional fallback)
$legacyNested = Join-Path $PSScriptRoot "pharos-agent.zip"

function New-ProperZip($zipPath, $prefix) {
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
  Get-ChildItem $src -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($src.Length).TrimStart('\')
    $entry = if ($prefix) { "$prefix/$($rel -replace '\\','/')" } else { $rel -replace '\\','/' }
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entry)
  }
  $zip.Dispose()
}

New-ProperZip $nested "prospilot"
New-ProperZip $flat ""
New-ProperZip $legacyNested "pharos-agent"
Write-Host "OK: $nested"
Write-Host "OK: $flat (SKILL.md at zip root - fallback only)"
Write-Host "OK: $legacyNested (legacy alias)"
