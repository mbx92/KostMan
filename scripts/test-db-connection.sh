#!/bin/bash

# ==============================================
# Database Connection Test Script
# ==============================================
# Tests PostgreSQL connection before deployment
# Usage: bash scripts/test-db-connection.sh

set -e

echo "🔍 Testing PostgreSQL Connection..."
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ .env file not found!"
    exit 1
fi

# Parse DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set in .env"
    exit 1
fi

echo "📋 Connection Details:"
echo "   DATABASE_URL: ${DATABASE_URL:0:30}..."
echo ""

# Test 1: Check if PostgreSQL is running on server
echo "🔌 Test 1: Checking if PostgreSQL port is open..."
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\(.*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

if command -v nc &> /dev/null; then
    if nc -zv $DB_HOST $DB_PORT 2>&1 | grep -q succeeded; then
        echo "✅ PostgreSQL port is reachable"
    else
        echo "❌ Cannot reach PostgreSQL at $DB_HOST:$DB_PORT"
        exit 1
    fi
else
    echo "⚠️  netcat not installed, skipping port check"
fi

# Test 2: Try to connect to database
echo ""
echo "🔑 Test 2: Testing database authentication..."

if command -v psql &> /dev/null; then
    if psql "$DATABASE_URL" -c "SELECT 1 as connection_test;" &>/dev/null; then
        echo "✅ Database connection successful"
    else
        echo "❌ Database connection failed"
        echo ""
        echo "Possible issues:"
        echo "  - Wrong password"
        echo "  - Database doesn't exist"
        echo "  - User doesn't have permissions"
        exit 1
    fi
else
    echo "⚠️  psql not installed, skipping connection test"
    echo "Install with: sudo apt install postgresql-client"
fi

# Test 3: Check if database exists and has tables
echo ""
echo "📊 Test 3: Checking database schema..."

if command -v psql &> /dev/null; then
    TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
    
    if [ ! -z "$TABLE_COUNT" ]; then
        echo "✅ Database exists with $TABLE_COUNT tables"
        
        if [ "$TABLE_COUNT" -eq "0" ]; then
            echo "⚠️  No tables found. Run migrations:"
            echo "   npm run db:push"
        fi
    fi
fi

# Test 4: Check Node.js can connect
echo ""
echo "🟢 Test 4: Testing Node.js connection..."

node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect()
  .then(() => {
    console.log('✅ Node.js PostgreSQL connection successful');
    return client.query('SELECT version()');
  })
  .then((res) => {
    console.log('📦 PostgreSQL version:', res.rows[0].version.split(' ').slice(0, 2).join(' '));
    return client.end();
  })
  .catch((err) => {
    console.error('❌ Node.js connection failed:', err.message);
    process.exit(1);
  });
" || echo "⚠️  Node.js pg module test failed"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All database tests passed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
