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

echo "Building Linux AppImage..."
npm run tauri build -- --bundles appimage

echo "Building Windows NSIS installer (target: $TARGET_TRIPLE)..."
npm run tauri build -- --target "$TARGET_TRIPLE" --runner "$RUNNER_BIN" --bundles nsis

cat <<EOT
Build complete.
- Linux AppImage artifacts: $LINUX_BUNDLE_DIR
- Windows NSIS artifacts: $WINDOWS_BUNDLE_DIR

Note: The NSIS output folder matches Tauri's default naming. Verify the generated installer before distributing.
EOT

