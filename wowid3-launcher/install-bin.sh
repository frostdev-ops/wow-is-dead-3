#!/bin/bash
# WOWID3 Launcher - Binary Installation Script for Arch Linux

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${1:$HOME/.local/opt/wowid3-launcher}"
BIN_NAME="wowid3-launcher"

echo "=== WOWID3 Launcher Installation Script ==="
echo "Install directory: $INSTALL_DIR"
echo ""

# Step 1: Build the Rust binary
echo "Step 1: Building binary..."
cd "$SCRIPT_DIR/src-tauri"
cargo build --release

# Find the binary
BINARY_PATH=$(find "$SCRIPT_DIR/src-tauri/target/release" -maxdepth 1 -type f -perm /111 | grep -E "(wowid3|launcher)" | head -1)

if [ -z "$BINARY_PATH" ]; then
    echo "Error: Could not find compiled binary!"
    exit 1
fi

echo "Binary found at: $BINARY_PATH"
echo ""

# Step 2: Create install directory
echo "Step 2: Creating installation directory..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$HOME/.local/share/icons/hicolor/256x256/apps"
mkdir -p "$HOME/.local/share/icons/hicolor/512x512/apps"
mkdir -p "$HOME/.local/share/applications"

# Step 3: Install binary
echo "Step 3: Installing binary..."
cp "$BINARY_PATH" "$INSTALL_DIR/$BIN_NAME"
chmod +x "$INSTALL_DIR/$BIN_NAME"

# Step 4: Install icons
echo "Step 4: Installing icons..."
cp "$SCRIPT_DIR/src-tauri/icons/256x256.png" "$HOME/.local/share/icons/hicolor/256x256/apps/com.wowid3.launcher.png"
cp "$SCRIPT_DIR/src-tauri/icons/512x512.png" "$HOME/.local/share/icons/hicolor/512x512/apps/com.wowid3.launcher.png"

# Also install to 128x128
mkdir -p "$HOME/.local/share/icons/hicolor/128x128/apps"
cp "$SCRIPT_DIR/src-tauri/icons/128x128.png" "$HOME/.local/share/icons/hicolor/128x128/apps/com.wowid3.launcher.png"

# Step 5: Create wrapper script with Wayland support
echo "Step 5: Creating Wayland wrapper..."
cat > "$INSTALL_DIR/wowid3-launcher-run" << 'WRAPPER'
#!/bin/bash
# Fix for WebKit DMABUF renderer issues on Wayland
export WEBKIT_DISABLE_DMABUF_RENDERER=1
export GSK_RENDERER=ngl

# Wayland detection and configuration
if [ "$XDG_SESSION_TYPE" = "wayland" ]; then
    export GDK_BACKEND=wayland,x11
else
    export GDK_BACKEND=x11
fi

# Get directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/wowid3-launcher" "$@"
WRAPPER

chmod +x "$INSTALL_DIR/wowid3-launcher-run"

# Step 6: Create .desktop file
echo "Step 6: Creating .desktop file..."
cat > "$HOME/.local/share/applications/wowid3-launcher.desktop" << DESKTOP
[Desktop Entry]
Type=Application
Name=WOWID3 Launcher
Comment=Minecraft launcher for WoW is Dead server
Exec=$INSTALL_DIR/wowid3-launcher-run
Icon=com.wowid3.launcher
Categories=Games;
Terminal=false
StartupWMClass=WOWID3 Launcher
DESKTOP

# Step 7: Update icon cache
echo "Step 7: Updating icon cache..."
gtk-update-icon-cache "$HOME/.local/share/icons/hicolor" 2>/dev/null || true

echo ""
echo "=== Installation Complete! ==="
echo ""
echo "Binary installed to: $INSTALL_DIR/$BIN_NAME"
echo "Wrapper script: $INSTALL_DIR/wowid3-launcher-run"
echo "Desktop file: $HOME/.local/share/applications/wowid3-launcher.desktop"
echo ""
echo "You can now run the launcher with:"
echo "  $INSTALL_DIR/wowid3-launcher-run"
echo ""
echo "Or find it in your application menu as 'WOWID3 Launcher'"
echo ""
echo "To update: Re-run this script or manually copy the new binary to:"
echo "  $INSTALL_DIR/$BIN_NAME"
