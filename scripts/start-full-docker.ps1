param(
    [switch]$Build
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root "docker\.env"
$envExample = Join-Path $root "docker\.env.example"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker is not installed or not in PATH. Install Docker Desktop first, then rerun this script."
}

if (-not (Test-Path $envFile)) {
    Copy-Item -LiteralPath $envExample -Destination $envFile
    Write-Host "Created docker\.env from docker\.env.example. Edit API keys and passwords there if needed."
}

$composeArgs = @("compose", "--env-file", "docker/.env", "-f", "docker/docker-compose.yml", "up", "-d")
if ($Build) {
    $composeArgs += "--build"
}

Set-Location $root
docker @composeArgs
