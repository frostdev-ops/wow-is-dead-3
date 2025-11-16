#!/bin/bash
# WOWID3 Launcher - Wayland Compatibility Wrapper
# This script sets environment variables to ensure proper Wayland support

# Fix for WebKit DMABUF renderer issues on Wayland (especially with NVIDIA GPUs)
# This prevents "Error 71 (Protocol error) dispatching to Wayland display"
export WEBKIT_DISABLE_DMABUF_RENDERER=1

# Use the new GL renderer for better Wayland compatibility
export GSK_RENDERER=ngl

# Automatically fallback to X11 if Wayland fails
# This ensures the launcher works on both Wayland and X11 systems
if [ "$XDG_SESSION_TYPE" = "wayland" ]; then
    echo "Detected Wayland session, using Wayland-compatible settings"
    # Try Wayland first, but allow fallback to X11
    export GDK_BACKEND=wayland,x11
else
    echo "Detected X11 session or no session type, using X11"
    export GDK_BACKEND=x11
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Execute the actual launcher binary
exec "$SCRIPT_DIR/wowid3-launcher" "$@"
