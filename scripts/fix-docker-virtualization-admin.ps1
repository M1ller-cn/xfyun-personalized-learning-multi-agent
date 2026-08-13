$ErrorActionPreference = "Continue"
$log = "D:\科大讯飞\docker-virtualization-fix.log"

Start-Transcript -Path $log -Append

Write-Host "== Docker virtualization fix ==" -ForegroundColor Cyan

Write-Host "Enable WSL..."
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

Write-Host "Enable Virtual Machine Platform..."
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

Write-Host "Enable Windows Hypervisor Platform..."
dism.exe /online /enable-feature /featurename:HypervisorPlatform /all /norestart

Write-Host "Enable Hyper-V Platform if available..."
dism.exe /online /enable-feature /featurename:Microsoft-Hyper-V-All /all /norestart

Write-Host "Set hypervisorlaunchtype=auto..."
bcdedit /set hypervisorlaunchtype auto

Write-Host "Update WSL..."
wsl --update
wsl --set-default-version 2

Write-Host ""
Write-Host "IMPORTANT: Restart Windows after this script finishes, then open Docker Desktop again." -ForegroundColor Yellow
Stop-Transcript
