#!/bin/bash
# WOWID3 Launcher Wrapper Script
# Handles Wayland/X11 detection and sets appropriate environment variables

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Determine the session type
if [ -n "$WAYLAND_DISPLAY" ]; then
    # Running on Wayland
    export WEBKIT_DISABLE_DMABUF_RENDERER=1
    export GSK_RENDERER=ngl
    export GDK_BACKEND=wayland,x11
elif [ -n "$DISPLAY" ]; then
    # Running on X11
    export GDK_BACKEND=x11
else
    # Fallback to X11
    export GDK_BACKEND=x11
fi

# Launch the actual application
exec "$SCRIPT_DIR/wowid3-launcher" "$@"
