#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_TRIPLE="x86_64-pc-windows-msvc"
RUNNER_BIN="cargo-xwin"
LINUX_BUNDLE_DIR="$ROOT_DIR/src-tauri/target/release/bundle/appimage"
WINDOWS_BUNDLE_DIR="$ROOT_DIR/src-tauri/target/$TARGET_TRIPLE/release/bundle/nsis"

cd "$ROOT_DIR"

require_binary() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command '$1'. Install requirements via scripts/setup-env.sh." >&2
    exit 1
  fi
}

require_binary npm
require_binary cargo
require_binary rustup
require_binary "$RUNNER_BIN"

if ! rustup target list --installed | grep -q "$TARGET_TRIPLE"; then
  echo "Rust target $TARGET_TRIPLE not found. Adding it now..."
  rustup target add "$TARGET_TRIPLE"
fi

if [[ "${SKIP_NPM_INSTALL:-0}" != "1" ]]; then
  echo "Installing/updating npm dependencies..."
  npm install
else
  echo "Skipping npm install (SKIP_NPM_INSTALL=1)."
fi

chmod +x "$ROOT_DIR/src-tauri/wowid3-launcher.sh"

# Check if .env.wayland exists and source it for Wayland compatibility
if [[ -f "$ROOT_DIR/.env.wayland" ]]; then
  echo "Sourcing .env.wayland for Wayland compatibility..."
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env.wayland"
else
  echo "Warning: .env.wayland not found. Build may have Wayland compatibility issues." >&2
fi

echo "Building Linux AppImage..."
# Build AppImage - if it fails due to icon mismatch, fix AppDir and manually bundle
LOG_FILE="/tmp/tauri-build-$$.log"
if ! npm run tauri build -- --bundles appimage 2>&1 | tee "$LOG_FILE"; then
    echo "Build failed, checking if AppDir was created..."
    APPIMAGE_APPDIR="$ROOT_DIR/src-tauri/target/release/bundle/appimage/WOWID3Launcher.AppDir"
    APPIMAGE_OUTPUT="$ROOT_DIR/src-tauri/target/release/bundle/appimage/WOWID3Launcher_0.1.0_amd64.AppImage"
    if [[ -d "$APPIMAGE_APPDIR" ]]; then
        echo "Fixing icon symlink issue in AppDir..."
        cd "$APPIMAGE_APPDIR"
        # Fix symlinks (icon name mismatch)
        [[ -f WOWID3Launcher.png && ! -f wowid3-launcher.png ]] && ln -sf WOWID3Launcher.png wowid3-launcher.png
        [[ -L .DirIcon ]] && rm -f .DirIcon && ln -sf WOWID3Launcher.png .DirIcon
        [[ -L WOWID3Launcher.desktop ]] && rm -f WOWID3Launcher.desktop && ln -sf usr/share/applications/WOWID3Launcher.desktop WOWID3Launcher.desktop
        
        # Replace AppRun with our Wayland-compatible wrapper
        if [[ -f "$ROOT_DIR/scripts/apprun-wrapper.sh" ]]; then
            echo "Replacing AppRun with Wayland wrapper..."
            mv AppRun AppRun.bin
            cp "$ROOT_DIR/scripts/apprun-wrapper.sh" AppRun
            chmod +x AppRun
        else
            echo "Warning: apprun-wrapper.sh not found, skipping AppRun replacement."
        fi
        
        cd "$ROOT_DIR"
        echo "Manually bundling AppImage with appimagetool..."
        if command -v appimagetool >/dev/null 2>&1; then
            appimagetool "$APPIMAGE_APPDIR" "$APPIMAGE_OUTPUT" || {
                echo "Failed to create AppImage manually. Check appimagetool output above." >&2
                exit 1
            }
            echo "AppImage created successfully: $APPIMAGE_OUTPUT"
        else
            echo "appimagetool not found. Install it to manually bundle AppImage." >&2
            exit 1
        fi
    else
        echo "AppDir not found. Original build error:" >&2
        grep -i error "$LOG_FILE" | tail -5 || tail -10 "$LOG_FILE"
        rm -f "$LOG_FILE"
        exit 1
    fi
fi
rm -f "$LOG_FILE"

echo "Building Windows NSIS installer (target: $TARGET_TRIPLE)..."
# For Windows targets, NSIS is the default bundle type (configured in tauri.conf.json)
# The --bundles flag only works for Linux bundles, so omit it for Windows builds
npm run tauri build -- --target "$TARGET_TRIPLE" --runner "$RUNNER_BIN"

cat <<EOT
Build complete.
- Linux AppImage artifacts: $LINUX_BUNDLE_DIR
- Windows NSIS artifacts: $WINDOWS_BUNDLE_DIR

Note: The NSIS output folder matches Tauri's default naming. Verify the generated installer before distributing.
EOT

