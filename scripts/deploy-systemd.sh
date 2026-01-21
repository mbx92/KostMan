#!/bin/bash

# ==============================================
# KostMan Systemd Deployment Script
# ==============================================
# For production deployment using systemd service
# Usage: bash scripts/deploy-systemd.sh

set -e  # Exit on error

echo "🚀 KostMan Systemd Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/home/mbx/projects/kosMan"
SERVICE_NAME="kosman.service"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}"

# Check if running as root for service operations
if [ "$EUID" -ne 0 ] && [ "$1" != "--no-service" ]; then 
    echo -e "${RED}❌ This script needs sudo for service management${NC}"
    echo "Run: sudo bash scripts/deploy-systemd.sh"
    echo "Or: bash scripts/deploy-systemd.sh --no-service (build only)"
    exit 1
fi

# Step 1: Stop service
if [ "$1" != "--no-service" ]; then
    echo -e "${YELLOW}[1/9]${NC} Stopping service..."
    systemctl stop kosman 2>/dev/null || echo "Service not running"
    echo "✅ Service stopped"
else
    echo -e "${YELLOW}[1/9]${NC} Skipping service stop (--no-service mode)"
fi

# Step 2: Navigate to app directory
echo -e "${YELLOW}[2/9]${NC} Navigating to app directory..."
cd "$APP_DIR"
echo "✅ Current directory: $(pwd)"

# Step 3: Pull latest code (optional)
echo -e "${YELLOW}[3/9]${NC} Checking for Git updates..."
if [ -d ".git" ]; then
    git pull origin main 2>/dev/null || echo "⚠️  Git pull skipped"
    echo "✅ Code updated"
else
    echo "⚠️  Not a git repository, skipping..."
fi

# Step 4: Clean old builds
echo -e "${YELLOW}[4/9]${NC} Cleaning old builds..."
rm -rf .nuxt .output node_modules/.cache
echo "✅ Cleaned: .nuxt, .output, cache"

# Step 5: Install dependencies
echo -e "${YELLOW}[5/9]${NC} Installing dependencies..."
npm ci --omit=dev
echo "✅ Dependencies installed"

# Step 6: Build application
echo -e "${YELLOW}[6/9]${NC} Building application..."
NODE_ENV=production npm run build
echo "✅ Build completed"

# Step 7: Run database migrations
echo -e "${YELLOW}[7/9]${NC} Running database migrations..."
npm run db:push || npm run db:migrate
echo "✅ Database migrated"

# Step 8: Update systemd service file
if [ "$1" != "--no-service" ]; then
    echo -e "${YELLOW}[8/9]${NC} Updating systemd service..."
    
    # Copy service file if exists in project
    if [ -f "kosman.service" ]; then
        cp kosman.service "$SERVICE_FILE"
        echo "✅ Service file updated"
    else
        echo "⚠️  No kosman.service file in project"
    fi
    
    # Reload systemd
    systemctl daemon-reload
    echo "✅ Systemd reloaded"
else
    echo -e "${YELLOW}[8/9]${NC} Skipping service update (--no-service mode)"
fi

# Step 9: Start and enable service
if [ "$1" != "--no-service" ]; then
    echo -e "${YELLOW}[9/9]${NC} Starting service..."
    systemctl enable kosman
    systemctl start kosman
    echo "✅ Service started"
else
    echo -e "${YELLOW}[9/9]${NC} Skipping service start (--no-service mode)"
    echo ""
    echo "To start manually:"
    echo "  sudo systemctl start kosman"
fi

# Summary
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📊 Service Status:${NC}"
systemctl status kosman --no-pager -l || true
echo ""
echo -e "${BLUE}🔍 Useful Commands:${NC}"
echo "  View status:  sudo systemctl status kosman"
echo "  View logs:    sudo journalctl -u kosman -f"
echo "  Restart:      sudo systemctl restart kosman"
echo "  Stop:         sudo systemctl stop kosman"
echo "  Start:        sudo systemctl start kosman"
echo ""
echo -e "${BLUE}🌐 Application URL:${NC}"
echo "  http://localhost:3004"
echo "  https://demo.ocnetworks.web.id"
echo ""
