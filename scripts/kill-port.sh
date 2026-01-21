#!/bin/bash

# ==============================================
# Kill Processes Using Specific Ports
# ==============================================
# Usage: bash scripts/kill-port.sh [PORT]
# Example: bash scripts/kill-port.sh 3004

PORT=${1:-3004}

echo "🔍 Finding processes using port $PORT..."

# Check if lsof is available
if ! command -v lsof &> /dev/null; then
    echo "❌ lsof not installed"
    echo "Install with: sudo apt install lsof"
    exit 1
fi

# Find process ID
PID=$(sudo lsof -ti:$PORT)

if [ -z "$PID" ]; then
    echo "✅ No process is using port $PORT"
    exit 0
fi

# Show process info
echo ""
echo "📊 Process using port $PORT:"
sudo lsof -i:$PORT
echo ""

# Kill the process
echo "🔪 Killing process(es): $PID"
sudo kill -9 $PID

# Verify
sleep 1
if sudo lsof -ti:$PORT &>/dev/null; then
    echo "❌ Failed to kill process on port $PORT"
    exit 1
else
    echo "✅ Successfully killed process on port $PORT"
fi
