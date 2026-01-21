#!/bin/bash

# ==============================================
# KostMan Production Deployment Script
# ==============================================
# Fixes common deployment issues and rebuilds
# Usage: bash scripts/deploy-production.sh

set -e  # Exit on error

echo "🚀 Starting KostMan Production Deployment..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Stop running application
echo -e "${YELLOW}[1/7]${NC} Stopping application..."
if command -v pm2 &> /dev/null; then
    pm2 stop kostman || true
    echo "✅ PM2 app stopped"
elif [ -f "docker-compose.yml" ]; then
    docker-compose down || true
    echo "✅ Docker containers stopped"
else
    echo "⚠️  No PM2 or Docker found, skipping..."
fi

# Step 2: Clean old builds
echo -e "${YELLOW}[2/7]${NC} Cleaning old builds..."
rm -rf .nuxt .output node_modules/.cache
echo "✅ Cleaned: .nuxt, .output, cache"

# Step 3: Install dependencies
echo -e "${YELLOW}[3/7]${NC} Installing dependencies..."
npm ci --only=production
echo "✅ Dependencies installed"

# Step 4: Build application
echo -e "${YELLOW}[4/7]${NC} Building application..."
NODE_ENV=production npm run build
echo "✅ Build completed"

# Step 5: Run migrations
echo -e "${YELLOW}[5/7]${NC} Running database migrations..."
npm run db:push || npm run db:migrate
echo "✅ Database migrated"

# Step 6: Generate security keys (if not exist)
echo -e "${YELLOW}[6/7]${NC} Checking security keys..."
if ! grep -q "JWT_SECRET=" .env || [ "$(grep JWT_SECRET .env | cut -d '=' -f2)" == "generate-with-openssl-rand-hex-32" ]; then
    echo "⚠️  Security keys not configured!"
    echo "Run: bash scripts/generate-keys.sh"
    echo "Then update .env file"
else
    echo "✅ Security keys configured"
fi

# Step 7: Start application
echo -e "${YELLOW}[7/7]${NC} Starting application..."
if command -v pm2 &> /dev/null; then
    pm2 start npm --name "kostman" -- start
    pm2 save
    echo "✅ PM2 app started"
elif [ -f "docker-compose.yml" ]; then
    docker-compose up -d
    echo "✅ Docker containers started"
else
    echo "⚠️  No PM2 or Docker found"
    echo "Manual start required: npm run preview"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📊 Check application status:"
echo "   pm2 status"
echo "   pm2 logs kostman"
echo ""
echo "🌐 Access your app at:"
echo "   http://your-domain.com:3000"
echo ""
