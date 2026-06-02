# Post-build pipeline for the single-HTML packaging.
# Run AFTER a Cocos "Web Mobile" build. It:
#   1. Picks the NEWEST build/web-mobile* folder (Cocos may emit web-mobile-001 etc.)
#      and mirrors it into build/web-mobile so the inliner has a stable source.
#   2. Palette-compresses PNG textures (lossless-ish, in place).
#   3. Strips embedded cover art + metadata from mp3s (mono) — fixes the jump.mp3
#      cover-art bloat that a fresh Cocos build re-introduces.
#   4. Runs tools/inline.js --no-spine to produce dist/index.html (gzipped engine).
#   5. Copies dist/index.html -> docs/index.html for GitHub Pages.
#
# Usage:  powershell -ExecutionPolicy Bypass -File tools\postbuild.ps1

# NOTE: keep 'Continue' — native tools (ffmpeg) write banners to stderr, and under
# 'Stop' PowerShell 5.1 turns that into a terminating NativeCommandError.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$buildRoot = Join-Path $root 'build'
$ff   = "C:\Users\Arsen\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe"
$node = "C:\Users\Arsen\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v26.2.0-win-x64\node.exe"
$dst  = Join-Path $buildRoot 'web-mobile'

# --- 1. choose newest build/web-mobile* with an index.html, mirror into web-mobile ---
$cands = Get-ChildItem $buildRoot -Directory | Where-Object { $_.Name -like 'web-mobile*' -and (Test-Path (Join-Path $_.FullName 'index.html')) }
$newest = $cands | Sort-Object { (Get-Item (Join-Path $_.FullName 'index.html')).LastWriteTime } -Descending | Select-Object -First 1
if (-not $newest) { throw "No build/web-mobile* with index.html found. Build in Cocos first." }
"Newest build: $($newest.Name)  ($((Get-Item (Join-Path $newest.FullName 'index.html')).LastWriteTime))"
if ($newest.FullName -ne $dst) {
  "Mirroring $($newest.Name) -> web-mobile"
  New-Item -ItemType Directory -Force $dst | Out-Null
  robocopy $newest.FullName $dst /MIR /NJH /NJS /NFL /NDL /R:1 /W:1 | Out-Null
}

# --- 2. compress PNGs (palette) in place ---
$tmp = Join-Path $root '_tmp_compress'; New-Item -ItemType Directory -Force $tmp | Out-Null
$pngs = Get-ChildItem (Join-Path $dst 'assets') -Recurse -Filter *.png
$n=0; $before=0; $after=0
foreach ($p in $pngs) {
  $before += $p.Length
  $pal = Join-Path $tmp 'pal.png'; $out = Join-Path $tmp 'out.png'
  & $ff -y -i $p.FullName -vf "format=rgba,palettegen=stats_mode=full:reserve_transparent=1" $pal 2>$null
  & $ff -y -i $p.FullName -i $pal -lavfi "format=rgba[x];[x][1:v]paletteuse=dither=sierra2_4a:alpha_threshold=128" $out 2>$null
  if ((Test-Path $out) -and ((Get-Item $out).Length -lt $p.Length)) { Copy-Item $out $p.FullName -Force; $n++ }
  $after += (Get-Item $p.FullName).Length
}
"PNG: {0:N2}MB -> {1:N2}MB ($n/$($pngs.Count) compressed)" -f ($before/1MB),($after/1MB)
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue

# --- 3. strip cover art / metadata from mp3s (mono) ---
$mp3s = Get-ChildItem (Join-Path $dst 'assets') -Recurse -Filter *.mp3
foreach ($f in $mp3s) {
  $sz0 = $f.Length; $t = "$($f.FullName).t.mp3"
  & $ff -y -i $f.FullName -map 0:a:0 -vn -map_metadata -1 -ac 1 -b:a 64k $t 2>$null
  if (Test-Path $t) {
    $sz1 = (Get-Item $t).Length
    if ($sz1 -lt $sz0) { Move-Item $t $f.FullName -Force; "mp3 {0}: {1}KB -> {2}KB" -f $f.BaseName.Substring(0,6),[int]($sz0/1KB),[int]($sz1/1KB) }
    else { Remove-Item $t -Force }
  }
}

# --- 4. inline -> dist/index.html ---
& $node (Join-Path $root 'tools\inline.js') --no-spine

# --- 5. publish copy ---
Copy-Item (Join-Path $root 'dist\index.html') (Join-Path $root 'docs\index.html') -Force
"docs/index.html: {0:N2} MB" -f ((Get-Item (Join-Path $root 'docs\index.html')).Length/1MB)
"DONE. Review, then: git add -A; git commit; git push"
