param(
    [string]$BaseUrl = "http://127.0.0.1:8080",
    [string]$AdminAccount = "admin",
    [string]$AdminPassword = "123"
)

$ErrorActionPreference = "Stop"
$utf8 = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8

function Invoke-JsonApi {
    param([string]$Method, [string]$Path, [hashtable]$Headers = @{}, $Body = $null)
    $params = @{ Method = $Method; Uri = "$BaseUrl$Path"; Headers = $Headers; TimeoutSec = 30 }
    if ($null -ne $Body) {
        $params.ContentType = "application/json; charset=utf-8"
        $params.Body = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 8 -Compress))
    }
    $response = Invoke-RestMethod @params
    if ($response.code -ne 0) { throw "API $Method $Path failed: $($response.message)" }
    return $response
}

$login = Invoke-JsonApi POST "/api/auth/login" -Body @{ userAccount = $AdminAccount; userPassword = $AdminPassword }
$result = Invoke-JsonApi GET "/api/platform/readiness" -Headers @{ Authorization = "Bearer $($login.data.token)" }

Write-Host "Platform readiness: $($result.data.status)" -ForegroundColor Cyan
foreach ($check in $result.data.checks) {
    $color = if ($check.status -eq "READY") { "Green" } elseif ($check.status -eq "DEGRADED") { "Yellow" } else { "Red" }
    Write-Host "[$($check.status)] $($check.name): $($check.detail)" -ForegroundColor $color
}

if (-not $result.data.ready) {
    throw "Platform is not ready for demonstration."
}
