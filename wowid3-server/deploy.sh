#!/bin/bash
set -e

# Configuration
REMOTE_USER="pma"
REMOTE_HOST="192.168.10.43"
REMOTE_PATH="/opt/wowid3-server"
WEB_PATH="/var/www/wowid3-admin"
SERVICE_NAME="wowid3-server"

echo "=== WOWID3 Server Deployment ==="
echo ""

# Check if built
if [ ! -f "server/target/release/wowid3-modpack-server" ]; then
    echo "Error: Backend binary not found. Run 'cd server && cargo build --release' first"
    exit 1
fi

if [ ! -d "web/dist" ]; then
    echo "Error: Admin panel dist not found. Run 'cd web && npm run build' first"
    exit 1
fi

echo "✓ Build artifacts found"
echo ""

# Create remote directories
echo "Creating remote directories..."
ssh ${REMOTE_USER}@${REMOTE_HOST} "sudo mkdir -p ${REMOTE_PATH} ${WEB_PATH}"
ssh ${REMOTE_USER}@${REMOTE_HOST} "sudo mkdir -p ${REMOTE_PATH}/storage/{releases,uploads}"

# Deploy backend binary
echo "Deploying backend binary..."
scp server/target/release/wowid3-modpack-server ${REMOTE_USER}@${REMOTE_HOST}:/tmp/
ssh ${REMOTE_USER}@${REMOTE_HOST} "sudo mv /tmp/wowid3-modpack-server ${REMOTE_PATH}/ && sudo chmod +x ${REMOTE_PATH}/wowid3-modpack-server"

# Deploy admin panel
echo "Deploying admin panel..."
rsync -avz --delete web/dist/ ${REMOTE_USER}@${REMOTE_HOST}:/tmp/wowid3-admin/
ssh ${REMOTE_USER}@${REMOTE_HOST} "sudo rm -rf ${WEB_PATH}/* && sudo mv /tmp/wowid3-admin/* ${WEB_PATH}/"

# Deploy systemd service
echo "Deploying systemd service..."
scp wowid3-server.service ${REMOTE_USER}@${REMOTE_HOST}:/tmp/
ssh ${REMOTE_USER}@${REMOTE_HOST} "sudo mv /tmp/wowid3-server.service /etc/systemd/system/"

# Deploy nginx config
echo "Deploying nginx configuration..."
scp nginx.conf ${REMOTE_USER}@${REMOTE_HOST}:/tmp/wowid3-nginx.conf
ssh ${REMOTE_USER}@${REMOTE_HOST} "sudo mv /tmp/wowid3-nginx.conf /etc/nginx/sites-available/wowid3 && sudo ln -sf /etc/nginx/sites-available/wowid3 /etc/nginx/sites-enabled/wowid3"

# Set permissions
echo "Setting permissions..."
ssh ${REMOTE_USER}@${REMOTE_HOST} "sudo chown -R wowid3:wowid3 ${REMOTE_PATH} 2>/dev/null || echo 'User wowid3 may not exist yet - you may need to create it'"

# Test nginx config
echo "Testing nginx configuration..."
ssh ${REMOTE_USER}@${REMOTE_HOST} "sudo nginx -t"

# Reload systemd and restart services
echo "Restarting services..."
ssh ${REMOTE_USER}@${REMOTE_HOST} "sudo systemctl daemon-reload"
ssh ${REMOTE_USER}@${REMOTE_HOST} "sudo systemctl enable ${SERVICE_NAME}"
ssh ${REMOTE_USER}@${REMOTE_HOST} "sudo systemctl restart ${SERVICE_NAME}"
ssh ${REMOTE_USER}@${REMOTE_HOST} "sudo systemctl reload nginx"

# Check service status
echo ""
echo "=== Service Status ==="
ssh ${REMOTE_USER}@${REMOTE_HOST} "sudo systemctl status ${SERVICE_NAME} --no-pager -l"

echo ""
echo "✓ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Create 'wowid3' user if it doesn't exist: sudo useradd -r -s /bin/false wowid3"
echo "2. Set ADMIN_PASSWORD: sudo systemctl edit ${SERVICE_NAME}"
echo "3. Check logs: sudo journalctl -u ${SERVICE_NAME} -f"
echo "4. Access admin panel: https://wowid-launcher.frostdev.io"
