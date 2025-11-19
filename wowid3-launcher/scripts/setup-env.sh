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
  local packages=(llvm clang lld)
  local nsis_package=""
  
  case "$DISTRO_ID" in
    arch|endeavouros|manjaro)
      # Install LLVM toolchain from main repos
      sudo pacman -Syu --needed "${packages[@]}"
      # NSIS is in AUR - check for AUR helper
      if command -v yay >/dev/null 2>&1; then
        echo "Installing NSIS via yay (AUR)..."
        yay -S --needed nsis
      elif command -v paru >/dev/null 2>&1; then
        echo "Installing NSIS via paru (AUR)..."
        paru -S --needed nsis
      else
        echo "Warning: NSIS not found in main repos and no AUR helper (yay/paru) detected." >&2
        echo "To install NSIS, either:" >&2
        echo "  1. Install an AUR helper (yay or paru) and rerun this script" >&2
        echo "  2. Manually install NSIS from AUR: https://aur.archlinux.org/packages/nsis" >&2
        echo "  3. Download NSIS from: https://nsis.sourceforge.io/Download" >&2
        echo "Continuing without NSIS - Windows builds may fail if makensis is not available." >&2
      fi
      ;;
    ubuntu|debian|pop|linuxmint)
      packages+=(nsis)
      sudo apt-get update
      sudo apt-get install -y "${packages[@]}"
      ;;
    fedora)
      packages+=(nsis)
      sudo dnf install -y "${packages[@]}"
      ;;
    *)
      echo "Unsupported distribution '$DISTRO_ID'." >&2
      echo "Please install the following packages manually: ${packages[*]} nsis" >&2
      ;;
  esac
  
  # Verify makensis is available (required by Tauri)
  if ! command -v makensis >/dev/null 2>&1; then
    echo "Warning: makensis not found in PATH. NSIS installer may not be available." >&2
    echo "Make sure NSIS is installed and makensis is accessible." >&2
  fi
  
  # Check for appimagetool (required for AppImage bundling)
  if ! command -v appimagetool >/dev/null 2>&1; then
    echo "Warning: appimagetool not found in PATH." >&2
    case "$DISTRO_ID" in
      arch|endeavouros|manjaro)
        if command -v yay >/dev/null 2>&1; then
          echo "Installing appimagetool via yay (AUR)..."
          yay -S --needed appimagetool
        elif command -v paru >/dev/null 2>&1; then
          echo "Installing appimagetool via paru (AUR)..."
          paru -S --needed appimagetool
        else
          echo "Install appimagetool from AUR or download from: https://github.com/AppImage/AppImageKit/releases" >&2
        fi
        ;;
      ubuntu|debian|pop|linuxmint)
        echo "Install appimagetool: sudo apt-get install appimagetool" >&2
        ;;
      fedora)
        echo "Install appimagetool: sudo dnf install appimagetool" >&2
        ;;
    esac
  fi
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

  if command -v cargo-xwin >/dev/null 2>&1; then
    echo "cargo-xwin is already installed."
    return 0
  fi

  # Check Rust version to determine compatible cargo-xwin version
  local rustc_version
  rustc_version=$(rustc --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "")
  
  if [[ -z "$rustc_version" ]]; then
    echo "Warning: Could not determine Rust version. Attempting to install latest cargo-xwin..." >&2
    cargo install cargo-xwin --locked
    return 0
  fi

  # Parse version components (major.minor.patch)
  local rust_major rust_minor
  IFS='.' read -r rust_major rust_minor _ <<< "$rustc_version"
  local rust_version_num=$((rust_major * 100 + rust_minor))

  # Version compatibility:
  # - cargo-xwin 0.20.2+ requires rustc 1.89+
  # - cargo-xwin 0.19.2 supports rustc 1.85+
  # - cargo-xwin 0.18.x supports rustc 1.75+
  
  local xwin_version=""
  if [[ $rust_version_num -ge 189 ]]; then
    # Rust 1.89+ - use latest
    echo "Installing latest cargo-xwin (compatible with Rust $rustc_version)..."
    cargo install cargo-xwin --locked
  elif [[ $rust_version_num -ge 185 ]]; then
    # Rust 1.85-1.88 - use 0.19.2
    echo "Installing cargo-xwin 0.19.2 (compatible with Rust $rustc_version)..."
    cargo install cargo-xwin --version 0.19.2 --locked
  elif [[ $rust_version_num -ge 175 ]]; then
    # Rust 1.75-1.84 - use 0.18.x
    echo "Installing cargo-xwin 0.18.4 (compatible with Rust $rustc_version)..."
    cargo install cargo-xwin --version 0.18.4 --locked
  else
    echo "Error: Rust version $rustc_version is too old (requires 1.75+)." >&2
    echo "Please update Rust: rustup update stable" >&2
    exit 1
  fi

  if ! command -v cargo-xwin >/dev/null 2>&1; then
    echo "Error: Failed to install cargo-xwin. Check errors above." >&2
    exit 1
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


