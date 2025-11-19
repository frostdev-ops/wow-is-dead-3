#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_TRIPLE="x86_64-pc-windows-msvc"

if [[ "${OSTYPE:-}" != linux* ]]; then
  echo "This setup script is intended to run on Linux hosts." >&2
  exit 1
fi

if [[ ! -f /etc/os-release ]]; then
  echo "Unable to detect distribution (missing /etc/os-release)." >&2
  exit 1
fi

. /etc/os-release
DISTRO_ID="${ID:-unknown}"

install_system_packages() {
  local packages=(nsis llvm clang lld)
  case "$DISTRO_ID" in
    arch|endeavouros|manjaro)
      sudo pacman -Syu --needed "${packages[@]}"
      ;;
    ubuntu|debian|pop|linuxmint)
      sudo apt-get update
      sudo apt-get install -y "${packages[@]}"
      ;;
    fedora)
      sudo dnf install -y "${packages[@]}"
      ;;
    *)
      echo "Unsupported distribution '$DISTRO_ID'. Install ${packages[*]} manually." >&2
      ;;
  esac
}

ensure_rust_target() {
  if ! command -v rustup >/dev/null 2>&1; then
    echo "rustup is not installed. Please install Rust (https://rustup.rs) and rerun." >&2
    exit 1
  fi

  if ! rustup target list --installed | grep -q "$TARGET_TRIPLE"; then
    rustup target add "$TARGET_TRIPLE"
  fi
}

ensure_cargo_xwin() {
  if ! command -v cargo >/dev/null 2>&1; then
    echo "cargo is not available. Install Rust toolchain first." >&2
    exit 1
  fi

  if ! command -v cargo-xwin >/dev/null 2>&1; then
    cargo install cargo-xwin --locked
  fi
}

echo "Installing system dependencies..."
install_system_packages

echo "Configuring Rust target ($TARGET_TRIPLE)..."
ensure_rust_target

echo "Installing cargo-xwin (cross-compilation toolchain)..."
ensure_cargo_xwin

cat <<'EOT'
Environment setup complete.
- System packages: nsis, llvm, clang, lld
- Rust target: x86_64-pc-windows-msvc
- cargo-xwin installed

Next step: run scripts/build-release.sh to build AppImage and NSIS installers.
EOT


