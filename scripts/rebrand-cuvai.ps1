# CuvAi rebrand — visible surfaces only. Protects backend identifiers.
# Uses .NET UTF-8 I/O (no BOM) so emojis / ✦ / → / … survive the round-trip.
# Run from repo root. Reviewable via `git diff` before commit.

$root = "C:\Users\awise\poursona"
$utf8 = New-Object System.Text.UTF8Encoding($false)   # UTF-8, no BOM

$targets = @()
$targets += Get-ChildItem -Path "$root\app" -Recurse -Include *.tsx,*.ts -File
$targets += Get-ChildItem -Path "$root\lib" -Recurse -Include *.ts -File
$targets += Get-Item "$root\middleware.ts"

# Hex color map. Old warm palette -> new cool CuvAi palette.
$hex = [ordered]@{
  '#C9A84C' = '#3FC6D4'; '#a07830' = '#2A9BA8'; '#F5ECD7' = '#E8EDF2'
  '#ece4cc' = '#DCE3EC'; '#d4c8a8' = '#C4CDD9'; '#9a8a64' = '#8A95A5'
  '#8a7a5a' = '#7B8598'; '#6a5a3a' = '#6B7588'; '#5a4a2a' = '#4A5468'
  '#4a3a1a' = '#3A4456'; '#3a2a0a' = '#2A3242'; '#2a1e0a' = '#1E2531'
  '#060403' = '#0C1018'; '#0a0805' = '#10141D'; '#0e0b06' = '#161C28'
  '#080604' = '#0A0E15'; '#0c1208' = '#101622'; '#0d0a07' = '#12161F'
  '#100c06' = '#141925'; '#0a0e08' = '#10141D'; '#0d1a0f' = '#0F1B26'
  '#071209' = '#0A1622'; '#0a1a08' = '#0C1B26'; '#0a0603' = '#0A0E15'
}

$repQuoted = '"''Space Grotesk'', sans-serif"'   # yields: "'Space Grotesk', sans-serif"
$changed = 0

foreach ($f in $targets) {
  $orig = [System.IO.File]::ReadAllText($f.FullName, $utf8)
  $t = $orig

  # 1. Brand name (case-sensitive; protects POURSONA_ env vars + lowercase identifiers/domain)
  $t = $t -creplace 'Pour-Sona', 'CuvAi'
  $t = $t -creplace 'Poursona', 'CuvAi'
  $t = $t -creplace 'POURSONA(?!_)', 'CUVAI'

  # 2. Font: Georgia serif -> Space Grotesk
  $t = $t -creplace "'Georgia,\s*serif'", $repQuoted
  $t = $t -creplace '"Georgia,\s*serif"', $repQuoted
  $t = $t -replace  'Georgia,\s*serif', "'Space Grotesk', sans-serif"
  $t = $t -creplace "'Georgia'", "'Space Grotesk'"

  # 3. Gold rgba triplet -> teal (keeps alpha)
  $t = $t -replace '201,\s*168,\s*76', '63,198,212'

  # 4. Hex palette swap
  foreach ($k in $hex.Keys) { $t = $t -replace [regex]::Escape($k), $hex[$k] }

  if ($t -ne $orig) {
    [System.IO.File]::WriteAllText($f.FullName, $t, $utf8)
    $changed++
  }
}
Write-Output "Rewrote $changed files."
