# WOWID3 Launcher - JVM Downloader (Windows)
# Run with: powershell -ExecutionPolicy Bypass -File download-jvm.ps1

$ErrorActionPreference = "Stop"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "WOWID3 Launcher - JVM Downloader" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Change to script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$ScriptDir\src-tauri"

# Create runtime directory
if (!(Test-Path "runtime")) {
    New-Item -ItemType Directory -Path "runtime" | Out-Null
}
Set-Location "runtime"

Write-Host "Platform: Windows x64" -ForegroundColor Green
Write-Host "Downloading Azul Zulu JVM 21.0.5..." -ForegroundColor Yellow

# Download URL
$url = "https://cdn.azul.com/zulu/bin/zulu21.38.21-ca-jdk21.0.5-win_x64.zip"
$output = "zulu-jdk.zip"

# Download with progress
try {
    Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing
    Write-Host "Download complete!" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to download JVM" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "Extracting..." -ForegroundColor Yellow
try {
    # Remove old version if exists
    if (Test-Path "java") {
        Remove-Item -Recurse -Force "java"
    }

    # Extract
    Expand-Archive -Path $output -DestinationPath "." -Force

    # Rename to 'java'
    Rename-Item -Path "zulu21.38.21-ca-jdk21.0.5-win_x64" -NewName "java"

    Write-Host "Extraction complete!" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to extract JVM" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "Cleaning up..." -ForegroundColor Yellow
Remove-Item $output

# Verify installation
Write-Host ""
Write-Host "Verifying installation..." -ForegroundColor Yellow
& ".\java\bin\java.exe" -version

Write-Host ""
Write-Host "✓ JVM installed successfully to: $PWD\java" -ForegroundColor Green
Write-Host "✓ Ready to build WOWID3 Launcher" -ForegroundColor Green
