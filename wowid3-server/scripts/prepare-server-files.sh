#!/bin/bash
# Prepare server files for upload to Pterodactyl
# Creates a tarball with all necessary server files

SERVER_DATA_DIR="../wowid3-server-data"
OUTPUT_FILE="server-files.tar.gz"

echo "=========================================="
echo "Preparing Server Files for Pterodactyl"
echo "=========================================="
echo ""

# Check if server data directory exists
if [ ! -d "$SERVER_DATA_DIR" ]; then
    echo "ERROR: Server data directory not found: $SERVER_DATA_DIR"
    exit 1
fi

cd "$SERVER_DATA_DIR" || exit 1

echo "Creating tarball with:"
echo "  - server.jar"
echo "  - mods/"
echo "  - config/"
echo "  - kubejs/"
echo "  - defaultconfigs/ (if exists)"
echo ""

# Create tarball with essential files
tar -czf "../wowid3-server/$OUTPUT_FILE" \
    --exclude='*.log' \
    --exclude='*.log.gz' \
    --exclude='world/*' \
    --exclude='logs/*' \
    --exclude='crash-reports/*' \
    --exclude='client-side-mods/*' \
    --exclude='libraries/*' \
    --exclude='versions/*' \
    --exclude='local/*' \
    --exclude='modernfix/*' \
    --exclude='.cache/*' \
    --exclude='backups/*' \
    server.jar \
    mods/ \
    config/ \
    kubejs/ \
    defaultconfigs/ \
    2>/dev/null

if [ $? -eq 0 ]; then
    cd - > /dev/null
    echo "=========================================="
    echo "✓ Server files packaged successfully!"
    echo "=========================================="
    echo ""
    echo "File: $OUTPUT_FILE"
    echo "Size: $(du -h $OUTPUT_FILE | cut -f1)"
    echo ""
    echo "Upload Instructions:"
    echo "1. In Pterodactyl panel, go to Files tab"
    echo "2. Upload $OUTPUT_FILE"
    echo "3. In console, run: tar -xzf $OUTPUT_FILE"
    echo "4. Start the server"
    echo ""
else
    echo "ERROR: Failed to create tarball"
    exit 1
fi

