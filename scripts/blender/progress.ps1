# Live progress bar for scripts/blender/build_anatomy.py
# Usage: powershell -File scripts/blender/progress.ps1 [-Out public/models/astronaut_anatomy.glb]
param([string]$Out = 'public/models/astronaut_anatomy.glb')
$file = "$Out.progress.json"
$names = @{ select = 'Selecting parts'; bake = 'Colouring + re-posing'; merge = 'Merging by zone'; decimate = 'Simplifying'; export = 'Exporting GLB' }
while ($true) {
  if (Test-Path $file) {
    $p = Get-Content $file -Raw | ConvertFrom-Json
    $pct = [double]$p.pct
    $bar = ('#' * [int]($pct / 4)).PadRight(25, '.')
    $eta = if ($p.eta_s) { '{0}:{1:00}' -f [int][math]::Floor($p.eta_s / 60), [int]($p.eta_s % 60) } else { '--:--' }
    Write-Host ("`r[{0}] {1,5:N1}%  left {2,5}  elapsed {3}s  {4}            " -f $bar, $pct, $eta, $p.elapsed_s, $names[$p.phase]) -NoNewline
    if ($pct -ge 100) { Write-Host "`nDone."; break }
  } else { Write-Host "`rWaiting for the build to start..." -NoNewline }
  if (-not (Get-Process blender -ErrorAction SilentlyContinue)) { Write-Host "`nBlender is not running."; break }
  Start-Sleep -Seconds 2
}
