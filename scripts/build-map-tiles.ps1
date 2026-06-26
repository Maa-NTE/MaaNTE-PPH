param(
  [string]$SourceDir = "maps-source",
  [string]$OutputDir = "public/map-tiles",
  [int]$TileSize = 256,
  [int]$MinZoom = -8,
  [int]$MaxZoom = 0,
  [ValidateSet("webp", "png")]
  [string]$TileFormat = "webp",
  [int]$WebpQuality = 92,
  [int]$WebpMethod = 0,
  [switch]$WebpLossless
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PythonScript = Join-Path $PSScriptRoot "build-map-tiles.py"

function Test-PillowPython([string]$PythonPath) {
  if (-not $PythonPath) {
    return $false
  }
  try {
    & $PythonPath -c "from PIL import Image, features; raise SystemExit(0 if features.check('webp') else 1)" | Out-Null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

$candidates = @()
if ($env:MAP_TILE_PYTHON) {
  $candidates += $env:MAP_TILE_PYTHON
}

$bundledPython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if (Test-Path $bundledPython) {
  $candidates += $bundledPython
}

$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
if ($pythonCommand) {
  $candidates += $pythonCommand.Source
}

$pyCommand = Get-Command py -ErrorAction SilentlyContinue
if ($pyCommand) {
  $candidates += $pyCommand.Source
}

$python = $candidates | Where-Object { Test-PillowPython $_ } | Select-Object -First 1
if (-not $python) {
  throw "No Python runtime with Pillow + WebP support found. Set MAP_TILE_PYTHON to a compatible python.exe."
}

$arguments = @(
  $PythonScript,
  "--source-dir", $SourceDir,
  "--output-dir", $OutputDir,
  "--tile-size", $TileSize,
  "--min-zoom", $MinZoom,
  "--max-zoom", $MaxZoom,
  "--format", $TileFormat,
  "--webp-quality", $WebpQuality,
  "--webp-method", $WebpMethod
)

if ($WebpLossless) {
  $arguments += "--webp-lossless"
}

Write-Host "Using Python: $python"
Push-Location $ProjectRoot
try {
  & $python @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Map tile build failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}
