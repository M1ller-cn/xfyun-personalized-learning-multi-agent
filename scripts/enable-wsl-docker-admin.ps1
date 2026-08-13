$ErrorActionPreference = "Continue"
$log = "D:\科大讯飞\docker-admin-setup.log"

Start-Transcript -Path $log -Append

Write-Host "== NovaCloudEdu Docker/WSL admin setup ==" -ForegroundColor Cyan
Write-Host "Enabling Windows Subsystem for Linux..."
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

Write-Host "Enabling Virtual Machine Platform..."
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

Write-Host "Trying WSL update..."
wsl --update
wsl --set-default-version 2

Write-Host "Starting Docker Desktop Service..."
Start-Service com.docker.service

Write-Host "Launching Docker Desktop..."
Start-Process -FilePath "C:\Program Files\Docker\Docker\Docker Desktop.exe"

Write-Host ""
Write-Host "If DISM says a restart is required, restart Windows before running docker compose." -ForegroundColor Yellow
Write-Host "Log written to $log"
Stop-Transcript
