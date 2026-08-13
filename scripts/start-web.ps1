param(
    [string]$HostName = "127.0.0.1",
    [int]$Port = 5173,
    [string]$ApiBaseUrl = "http://localhost:8080"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$webDir = Join-Path $root "web"

Set-Location $webDir
$env:VITE_API_BASE_URL = $ApiBaseUrl

if (-not (Test-Path (Join-Path $webDir "node_modules"))) {
    npm install
}

npm run dev -- --host $HostName --port $Port
