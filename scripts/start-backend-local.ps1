param(
    [string]$DbHost = "localhost",
    [int]$DbPort = 5432,
    [string]$DbName = "novacloudedu",
    [string]$DbUsername = "nova",
    [string]$DbPassword = "changeme_postgres_password_123",
    [string]$RedisHost = "localhost",
    [int]$RedisPort = 6379,
    [string]$RedisPassword = "changeme_redis_password_123"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $root "backend"
$jdkDir = Join-Path (Split-Path -Parent $root) "_tools\jdk-21"

if (Test-Path (Join-Path $jdkDir "bin\java.exe")) {
    $env:JAVA_HOME = $jdkDir
    $env:Path = "$jdkDir\bin;$env:Path"
}

$env:SPRING_PROFILES_ACTIVE = "dev"
$env:DB_HOST = $DbHost
$env:DB_PORT = "$DbPort"
$env:DB_NAME = $DbName
$env:DB_USERNAME = $DbUsername
$env:DB_PASSWORD = $DbPassword
$env:REDIS_HOST = $RedisHost
$env:REDIS_PORT = "$RedisPort"
$env:REDIS_PASSWORD = $RedisPassword
$env:CODE_SANDBOX_DOCKER_ENABLED = "false"
$env:DEEPSEEK_ENABLED = "true"
$env:AI_DEFAULT_MODEL = "deepseek/deepseek-v4-pro"

Set-Location $backendDir
.\mvnw.cmd spring-boot:run
