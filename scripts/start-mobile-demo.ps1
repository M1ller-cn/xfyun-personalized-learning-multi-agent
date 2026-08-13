$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$webRoot = Join-Path $projectRoot 'web'
$port = 5174
$url = "http://127.0.0.1:$port/mobile-demo"

$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
    Start-Process -FilePath 'npm.cmd' `
        -ArgumentList @('run', 'dev', '--', '--host', '127.0.0.1', '--port', "$port") `
        -WorkingDirectory $webRoot `
        -WindowStyle Hidden

    $deadline = (Get-Date).AddSeconds(20)
    do {
        Start-Sleep -Milliseconds 500
        $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    } while (-not $listener -and (Get-Date) -lt $deadline)
}

if (-not $listener) {
    throw "移动端演示服务未能在端口 $port 启动。请先在 web 目录执行 npm install。"
}

Start-Process $url
Write-Host "星图智课移动端演示已启动：$url"
