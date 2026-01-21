#!/bin/bash

# ==============================================
# KostMan Security Keys Generator
# ==============================================
# This script generates secure random keys for production
# Usage: bash scripts/generate-keys.sh

echo "🔐 Generating secure keys for KostMan..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Copy these to your .env file:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Generate JWT Secret (256-bit)
JWT_SECRET=$(openssl rand -hex 32)
echo "JWT_SECRET=\"$JWT_SECRET\""

# Generate Encryption Key (256-bit)
ENCRYPTION_KEY=$(openssl rand -hex 32)
echo "ENCRYPTION_KEY=\"$ENCRYPTION_KEY\""

# Generate Session Secret (256-bit)
SESSION_SECRET=$(openssl rand -hex 32)
echo "SESSION_SECRET=\"$SESSION_SECRET\""

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Keys generated successfully!"
echo ""
echo "⚠️  IMPORTANT:"
echo "   1. Copy the keys above to your .env file"
echo "   2. NEVER commit these keys to version control"
echo "   3. Keep these keys secure and backed up"
echo "   4. Use different keys for dev/staging/production"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
