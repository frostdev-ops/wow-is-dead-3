#!/bin/bash
# Generate a secure tracker secret

# Generate 256-bit (32-byte) random hex secret
if command -v openssl &> /dev/null; then
    SECRET=$(openssl rand -hex 32)
elif command -v python3 &> /dev/null; then
    SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
elif command -v node &> /dev/null; then
    SECRET=$(node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('hex'))")
else
    echo "Error: No suitable tool found to generate secret (need openssl, python3, or node)"
    exit 1
fi

echo "Generated Tracker Secret:"
echo "========================"
echo "$SECRET"
echo ""
echo "Add this to your server .env file or systemd service:"
echo "TRACKER_SECRET=$SECRET"
echo ""
echo "For the Fabric mod config, use this value:"
echo "$SECRET"

