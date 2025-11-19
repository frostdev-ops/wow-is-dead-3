# WOWID3 Launcher - Christmas Edition

Custom Minecraft launcher for the WOWID3 modpack built with Tauri 2.x, React, and TypeScript.

## Features

- Microsoft OAuth authentication for Minecraft accounts
- Automatic modpack downloading and updating
- Server status monitoring
- Discord Rich Presence integration
- Bundled Java runtime (Azul Zulu JVM 21)
- Full Wayland support with X11 fallback

## Local Build Workflow

Build both Linux (AppImage) and Windows (NSIS `.exe`) artifacts directly from Linux using the helper scripts in `scripts/`.

1. **One-time setup**

   ```bash
   cd wowid3-launcher
   ./scripts/setup-env.sh
   ```

   This installs `nsis`, `llvm`, `clang`, `lld`, adds the `x86_64-pc-windows-msvc` Rust target, and installs `cargo-xwin` for cross-compilation.

2. **Build release artifacts**

   ```bash
   ./scripts/build-release.sh
   ```

   - Produces Linux AppImage bundles under `src-tauri/target/release/bundle/appimage`
   - Produces Windows NSIS installers under `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis`

Set `SKIP_NPM_INSTALL=1` when re-running builds and you are sure dependencies are already installed.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Linux Wayland Support

The launcher includes full Wayland support with automatic fallback to X11. This is configured through environment variables that fix common Wayland protocol errors.

### Running in Development

To run the launcher in development mode on Wayland:

```bash
# Source the Wayland environment variables
source .env.wayland && npm run tauri dev
```

Or manually set the variables:

```bash
WEBKIT_DISABLE_DMABUF_RENDERER=1 GSK_RENDERER=ngl npm run tauri dev
```

### Production Builds

Production builds (AppImage, deb) automatically include the `wowid3-launcher.sh` wrapper script that sets the appropriate environment variables for Wayland compatibility. The launcher will:

1. Detect if running on Wayland or X11
2. Set WebKit compatibility flags for Wayland
3. Automatically fallback to X11 (via XWayland) if Wayland fails

### Troubleshooting Wayland Issues

If you encounter "Error 71 (Protocol error) dispatching to Wayland display":

1. **Development Mode**: Use the `.env.wayland` file as shown above
2. **Force X11**: Set `GDK_BACKEND=x11` before running the launcher
3. **NVIDIA Users**: The `WEBKIT_DISABLE_DMABUF_RENDERER=1` flag is specifically important for NVIDIA GPU users

### Technical Details

The Wayland support addresses several known issues:

- **WebKit DMABUF Renderer**: Disabled via `WEBKIT_DISABLE_DMABUF_RENDERER=1` to fix protocol errors on NVIDIA systems
- **GSK Renderer**: Set to `ngl` for better Wayland compatibility
- **Backend Fallback**: `GDK_BACKEND=wayland,x11` allows automatic fallback to X11 if Wayland fails

See [Tauri Issue #10702](https://github.com/tauri-apps/tauri/issues/10702) for more details on the upstream Wayland protocol error.
