#!/bin/bash
# WOWID3 Launcher - Wayland Compatibility Wrapper
# This script sets environment variables to ensure proper Wayland support

# Fix for WebKit DMABUF renderer issues on Wayland (especially with NVIDIA GPUs)
export WEBKIT_DISABLE_DMABUF_RENDERER=1
export GSK_RENDERER=ngl

# Automatically fallback to X11 if Wayland fails
if [ "$XDG_SESSION_TYPE" = "wayland" ]; then
    [ -n "$DEBUG" ] && echo "Detected Wayland session, using Wayland-compatible settings" >&2
    export GDK_BACKEND=wayland,x11
else
    [ -n "$DEBUG" ] && echo "Detected X11 session, using X11 backend" >&2
    export GDK_BACKEND=x11
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BINARY="$SCRIPT_DIR/wowid3-launcher"

# Verify binary exists and is executable
if [ ! -x "$BINARY" ]; then
    echo "Error: Cannot find executable launcher at $BINARY" >&2
    echo "Please verify installation or contact support." >&2
    exit 1
fi

# Execute the actual launcher binary
exec "$BINARY" "$@"
