param(
    [string]$UpstreamDir = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($UpstreamDir)) {
    $UpstreamDir = Join-Path (Split-Path -Parent $root) "_upstream_NovaCloudEdu"
}

if (-not (Test-Path $UpstreamDir)) {
    throw "Upstream directory not found: $UpstreamDir"
}

$exclude = "\\(\.git|node_modules|dist|target|\.dart_tool|build|\.gradle|\.idea|\.vscode)\\"

$currentFiles = Get-ChildItem -LiteralPath $root -Recurse -File -Force |
    Where-Object { $_.FullName.Substring($root.Length) -notmatch $exclude } |
    ForEach-Object { $_.FullName.Substring($root.Length + 1) } |
    Sort-Object

$upstreamFiles = Get-ChildItem -LiteralPath $UpstreamDir -Recurse -File -Force |
    Where-Object { $_.FullName.Substring($UpstreamDir.Length) -notmatch $exclude } |
    ForEach-Object { $_.FullName.Substring($UpstreamDir.Length + 1) } |
    Sort-Object

$missing = Compare-Object $currentFiles $upstreamFiles |
    Where-Object SideIndicator -eq "=>" |
    Select-Object -ExpandProperty InputObject

$extra = Compare-Object $currentFiles $upstreamFiles |
    Where-Object SideIndicator -eq "<=" |
    Select-Object -ExpandProperty InputObject

[pscustomobject]@{
    CurrentFiles = $currentFiles.Count
    UpstreamFiles = $upstreamFiles.Count
    MissingFromCurrent = $missing.Count
    ExtraInCurrent = $extra.Count
    ExtraFiles = $extra
}
