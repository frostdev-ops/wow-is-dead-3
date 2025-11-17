#!/bin/bash
set -e

echo "================================"
echo "WOWID3 Launcher - JVM Downloader"
echo "================================"
echo ""

# Change to script directory
cd "$(dirname "$0")/src-tauri"

# Create runtime directory
mkdir -p runtime
cd runtime

# Detect platform
PLATFORM=$(uname -s)
ARCH=$(uname -m)

if [ "$PLATFORM" = "Linux" ] && [ "$ARCH" = "x86_64" ]; then
    echo "Platform: Linux x86_64"
    echo "Downloading Azul Zulu JVM 21.0.5..."

    # Download
    wget https://cdn.azul.com/zulu/bin/zulu21.38.21-ca-jdk21.0.5-linux_x64.tar.gz

    echo "Extracting..."
    tar -xzf zulu21.38.21-ca-jdk21.0.5-linux_x64.tar.gz

    echo "Installing..."
    rm -rf java  # Remove old version if exists
    mv zulu21.38.21-ca-jdk21.0.5-linux_x64 java

    echo "Cleaning up..."
    rm zulu21.38.21-ca-jdk21.0.5-linux_x64.tar.gz

    echo "Setting permissions..."
    chmod +x java/bin/*

elif [ "$PLATFORM" = "Darwin" ]; then
    echo "Platform: macOS"
    echo "ERROR: macOS support not yet implemented"
    echo "Please download manually from: https://www.azul.com/downloads/?package=jdk#zulu"
    exit 1

else
    echo "Platform: Windows or other"
    echo "ERROR: This script is for Linux only"
    echo "For Windows, run: powershell -ExecutionPolicy Bypass -File download-jvm.ps1"
    exit 1
fi

# Verify installation
echo ""
echo "Verifying installation..."
./java/bin/java -version

echo ""
echo "✓ JVM installed successfully to: $(pwd)/java"
echo "✓ Ready to build WOWID3 Launcher"
