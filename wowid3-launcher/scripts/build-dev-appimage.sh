#!/bin/bash
set -e

# Build Development AppImage with Console/DevTools Enabled
# This builds an AppImage with the Tauri devtools feature enabled for debugging production builds

echo "🔧 Building Development AppImage with DevTools enabled..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo -e "${YELLOW}📋 Pre-flight checks...${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "src-tauri" ]; then
    echo -e "${RED}❌ Error: Must be run from launcher project root${NC}"
    exit 1
fi

# Check if Cargo.toml exists
if [ ! -f "src-tauri/Cargo.toml" ]; then
    echo -e "${RED}❌ Error: src-tauri/Cargo.toml not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Project structure valid${NC}"
echo ""

# Backup Cargo.toml
echo -e "${YELLOW}💾 Backing up Cargo.toml...${NC}"
cp src-tauri/Cargo.toml src-tauri/Cargo.toml.backup

# Add devtools feature to Cargo.toml temporarily
echo -e "${YELLOW}🔧 Enabling devtools feature...${NC}"
# Use a more precise sed command that only modifies the tauri line
sed -i '/^tauri = {.*features = \[/ s/\]/, "devtools"]/' src-tauri/Cargo.toml
echo -e "${GREEN}✓ Devtools feature enabled${NC}"

# Restore function
restore_cargo() {
    echo ""
    echo -e "${YELLOW}🔄 Restoring original Cargo.toml...${NC}"
    mv src-tauri/Cargo.toml.backup src-tauri/Cargo.toml
    echo -e "${GREEN}✓ Cargo.toml restored${NC}"
}

# Set trap to restore on exit
trap restore_cargo EXIT

echo ""
echo -e "${YELLOW}📦 Building frontend...${NC}"
npm run build

echo ""
echo -e "${YELLOW}🏗️  Building Tauri AppImage (this may take several minutes)...${NC}"
echo -e "${YELLOW}   Building with devtools enabled for console access${NC}"
echo ""

# Build AppImage - if it fails due to icon mismatch, fix AppDir and manually bundle
LOG_FILE="/tmp/tauri-dev-build-$$.log"
npm run tauri build -- --bundles appimage 2>&1 | tee "$LOG_FILE"

APPIMAGE_APPDIR="$PROJECT_ROOT/src-tauri/target/release/bundle/appimage/WOWID3Launcher.AppDir"
APPIMAGE_OUTPUT="$PROJECT_ROOT/src-tauri/target/release/bundle/appimage/WOWID3Launcher_1.1.2_amd64.AppImage"

# Check if AppImage was actually created
if [[ ! -f "$APPIMAGE_OUTPUT" && -d "$APPIMAGE_APPDIR" ]]; then
    echo ""
    echo -e "${YELLOW}⚠️  AppImage not created, attempting manual bundle...${NC}"
        echo -e "${YELLOW}Fixing icon symlink issue in AppDir...${NC}"
        cd "$APPIMAGE_APPDIR"
        # Fix symlinks (icon name mismatch)
        [[ -f WOWID3Launcher.png && ! -f wowid3-launcher.png ]] && ln -sf WOWID3Launcher.png wowid3-launcher.png
        [[ -L .DirIcon ]] && rm -f .DirIcon && ln -sf WOWID3Launcher.png .DirIcon
        [[ -L WOWID3Launcher.desktop ]] && rm -f WOWID3Launcher.desktop && ln -sf usr/share/applications/WOWID3Launcher.desktop WOWID3Launcher.desktop

        # Replace AppRun with our Wayland-compatible wrapper
        if [[ -f "$PROJECT_ROOT/scripts/apprun-wrapper.sh" ]]; then
            echo -e "${YELLOW}Replacing AppRun with Wayland wrapper...${NC}"
            mv AppRun AppRun.bin 2>/dev/null || true
            cp "$PROJECT_ROOT/scripts/apprun-wrapper.sh" AppRun
            chmod +x AppRun
        else
            echo -e "${YELLOW}Warning: apprun-wrapper.sh not found, skipping AppRun replacement.${NC}"
        fi

        cd "$PROJECT_ROOT"
        echo -e "${YELLOW}Manually bundling AppImage with appimagetool...${NC}"
        if command -v appimagetool >/dev/null 2>&1; then
            appimagetool "$APPIMAGE_APPDIR" "$APPIMAGE_OUTPUT" || {
                echo -e "${RED}Failed to create AppImage manually. Check appimagetool output above.${NC}" >&2
                exit 1
            }
            echo -e "${GREEN}AppImage created successfully: $APPIMAGE_OUTPUT${NC}"
        else
            echo -e "${RED}appimagetool not found. Install it to manually bundle AppImage.${NC}" >&2
            exit 1
        fi
else
    echo -e "${RED}AppDir not found. Original build error:${NC}" >&2
    grep -i error "$LOG_FILE" | tail -5 || tail -10 "$LOG_FILE"
    rm -f "$LOG_FILE"
    exit 1
fi

# Verify AppImage was created
if [[ ! -f "$APPIMAGE_OUTPUT" ]]; then
    echo ""
    echo -e "${RED}❌ Failed to create AppImage${NC}"
    echo -e "${RED}Check build errors above${NC}"
    rm -f "$LOG_FILE"
    exit 1
fi
rm -f "$LOG_FILE"

echo ""
echo -e "${GREEN}✅ Development AppImage built successfully!${NC}"
echo ""
echo -e "${YELLOW}📍 Location:${NC}"
echo "   $PROJECT_ROOT/src-tauri/target/release/bundle/appimage/"
echo ""
ls -lh "$PROJECT_ROOT/src-tauri/target/release/bundle/appimage/"*.AppImage 2>/dev/null || echo "   No AppImage found - check build output above"
echo ""
echo -e "${YELLOW}🔍 To debug:${NC}"
echo "   1. Run the AppImage: ./WOWID3Launcher_*.AppImage"
echo "   2. Right-click in the app and select 'Inspect Element' or press F12"
echo "   3. Check the Console tab for debug logs"
echo ""
echo -e "${GREEN}🎉 Build complete!${NC}"
