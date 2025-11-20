#!/bin/bash

###############################################################################
# WOWID3 Build & Deploy Script
# Builds and deploys both frontend and backend to remote server
###############################################################################

set -euo pipefail

# Configuration
REMOTE_HOST="${REMOTE_HOST:-pma@192.168.10.43}"
REMOTE_FRONTEND_PATH="/var/www/wowid3-admin"
REMOTE_BACKEND_BIN="/usr/local/bin/wowid3-server"
REMOTE_SERVICE="wowid3-server"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}→${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

section() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
}

# Verify we're in the right directory
if [ ! -f "server/Cargo.toml" ] || [ ! -f "web/package.json" ]; then
    log_error "This script must be run from the wowid3-server directory"
    exit 1
fi

# Check if remote server is accessible
log_info "Checking remote server connectivity..."
if ! ssh -q "$REMOTE_HOST" "exit" 2>/dev/null; then
    log_error "Cannot connect to $REMOTE_HOST"
    exit 1
fi
log_success "Remote server is accessible"

###############################################################################
# Build Frontend
###############################################################################
section "Building Frontend"

log_info "Cleaning old build..."
cd web
rm -rf dist node_modules

log_info "Installing dependencies..."
npm install --silent 2>&1 | grep -E "added|removed|up to date" || true

log_info "Building frontend..."
npm run build 2>&1 | tail -5

log_success "Frontend build complete"
cd ..

###############################################################################
# Build Backend
###############################################################################
section "Building Backend"

log_info "Cleaning old build..."
cd server
cargo clean --quiet

log_info "Building backend (release mode)..."
if ! cargo build --release 2>&1 | tail -10; then
    log_error "Backend build failed"
    exit 1
fi

BACKEND_BIN="target/release/wowid3-modpack-server"
if [ ! -f "$BACKEND_BIN" ]; then
    log_error "Backend binary not found at $BACKEND_BIN"
    exit 1
fi

BACKEND_SIZE=$(du -h "$BACKEND_BIN" | cut -f1)
log_success "Backend build complete (Size: $BACKEND_SIZE)"
cd ..

###############################################################################
# Deploy Frontend
###############################################################################
section "Deploying Frontend"

log_info "Syncing frontend files to $REMOTE_HOST..."
if rsync -avz --delete web/dist/ "$REMOTE_HOST:$REMOTE_FRONTEND_PATH/" 2>&1 | tail -3; then
    log_success "Frontend deployed successfully"
else
    log_error "Frontend deployment failed"
    exit 1
fi

###############################################################################
# Deploy Backend
###############################################################################
section "Deploying Backend"

log_info "Stopping backend service..."
if ssh "$REMOTE_HOST" "sudo systemctl stop $REMOTE_SERVICE" 2>&1; then
    log_success "Backend service stopped"
else
    log_warning "Could not stop service (might already be stopped)"
fi

log_info "Uploading backend binary..."
if scp "server/$BACKEND_BIN" "$REMOTE_HOST:/tmp/wowid3-server-new" >/dev/null 2>&1; then
    log_success "Backend binary uploaded"
else
    log_error "Failed to upload backend binary"
    exit 1
fi

log_info "Installing backend binary..."
if ssh "$REMOTE_HOST" "sudo mv /tmp/wowid3-server-new $REMOTE_BACKEND_BIN && sudo chmod +x $REMOTE_BACKEND_BIN"; then
    log_success "Backend binary installed"
else
    log_error "Failed to install backend binary"
    exit 1
fi

# Deploy systemd service file with TRACKER_SECRET injected
if [ -f "server/.tracker_secret" ]; then
    TRACKER_SECRET=$(cat server/.tracker_secret | tr -d '\n\r ')
    log_info "Injecting TRACKER_SECRET into systemd service file..."

    # Create temporary service file with secret injected
    sed "s|TRACKER_SECRET=PLACEHOLDER|TRACKER_SECRET=$TRACKER_SECRET|" wowid3-server.service > /tmp/wowid3-server.service.tmp

    # Upload and install service file
    if scp /tmp/wowid3-server.service.tmp "$REMOTE_HOST:/tmp/wowid3-server.service" >/dev/null 2>&1; then
        if ssh "$REMOTE_HOST" "sudo mv /tmp/wowid3-server.service /etc/systemd/system/wowid3-server.service && sudo systemctl daemon-reload"; then
            log_success "Service file deployed with TRACKER_SECRET"
        else
            log_error "Failed to install service file"
            exit 1
        fi
    else
        log_error "Failed to upload service file"
        exit 1
    fi

    # Clean up temp file
    rm -f /tmp/wowid3-server.service.tmp
else
    log_warning "No .tracker_secret file found - tracker will use default secret"
    log_warning "Generate one with: python3 gen_secret.py > server/.tracker_secret"
fi

log_info "Starting backend service..."
sleep 1
if ssh "$REMOTE_HOST" "sudo systemctl start $REMOTE_SERVICE"; then
    log_success "Backend service started"
else
    log_error "Failed to start backend service"
    exit 1
fi

sleep 2

###############################################################################
# Verification
###############################################################################
section "Verifying Deployment"

log_info "Checking backend health..."
if ssh "$REMOTE_HOST" "curl -s http://127.0.0.1:5566/health | jq -e '.status == \"ok\"' >/dev/null 2>&1"; then
    log_success "Backend health check passed"
else
    log_error "Backend health check failed"
    exit 1
fi

log_info "Checking service status..."
if ssh "$REMOTE_HOST" "systemctl is-active --quiet $REMOTE_SERVICE"; then
    SERVICE_INFO=$(ssh "$REMOTE_HOST" "systemctl status $REMOTE_SERVICE --no-pager | grep -E 'Active|Memory'")
    echo "$SERVICE_INFO" | sed 's/^/  /'
    log_success "Service is active"
else
    log_error "Service is not running"
    exit 1
fi

log_info "Testing upload endpoint..."
UPLOAD_TEST=$(ssh "$REMOTE_HOST" "
    dd if=/dev/zero of=/tmp/test-deploy.bin bs=1M count=1 2>/dev/null
    curl -s -X POST 'http://127.0.0.1:5566/api/admin/upload' \
      -H 'Authorization: Bearer test' \
      -F 'files=@/tmp/test-deploy.bin' | jq -r '.[0].message'
")

if [ "$UPLOAD_TEST" = "File uploaded successfully" ]; then
    log_success "Upload endpoint is working"
else
    log_warning "Upload test returned: $UPLOAD_TEST"
fi

###############################################################################
# Summary
###############################################################################
section "Deployment Complete"

log_success "Frontend: Deployed to $REMOTE_HOST:$REMOTE_FRONTEND_PATH"
log_success "Backend: Deployed to $REMOTE_HOST:$REMOTE_BACKEND_BIN"
log_success "Service: Running and healthy"

echo ""
log_info "Recent logs from backend:"
ssh "$REMOTE_HOST" "journalctl -u $REMOTE_SERVICE -n 3 --no-pager" | sed 's/^/  /'

echo ""
log_info "Deployment URL: http://192.168.10.43:5565"
echo ""
