#!/usr/bin/env bash

# Database Copy Script for KostMan
# Copies a PostgreSQL database from source to target

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values from .env
SOURCE_DB="${1:-kostMan_dev}"
TARGET_DB="${2:-kostman_prod}"

# Database connection details (modify as needed)
DB_USER="${DB_USER:-mbx}"
DB_PASSWORD="${DB_PASSWORD:-nopassword123!}"
DB_HOST="${DB_HOST:-10.100.10.5}"
DB_PORT="${DB_PORT:-5432}"

echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║  KostMan Database Copy Utility        ║${NC}"
echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
echo ""
echo -e "Source Database: ${GREEN}${SOURCE_DB}${NC}"
echo -e "Target Database: ${GREEN}${TARGET_DB}${NC}"
echo ""

# Confirmation
read -p "This will REPLACE ${TARGET_DB} with a copy of ${SOURCE_DB}. Continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]
then
    echo -e "${RED}Aborted.${NC}"
    exit 1
fi

export PGPASSWORD="${DB_PASSWORD}"

echo -e "${YELLOW}[1/5]${NC} Checking if source database exists..."
if ! psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -lqt | cut -d \| -f 1 | grep -qw "${SOURCE_DB}"; then
    echo -e "${RED}Error: Source database '${SOURCE_DB}' does not exist!${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Source database exists"

echo -e "${YELLOW}[2/5]${NC} Dropping target database if exists..."
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS \"${TARGET_DB}\" WITH (FORCE);" 2>/dev/null || true
echo -e "${GREEN}✓${NC} Target database dropped"

echo -e "${YELLOW}[3/5]${NC} Creating target database..."
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "CREATE DATABASE \"${TARGET_DB}\";"
echo -e "${GREEN}✓${NC} Target database created"

echo -e "${YELLOW}[4/5]${NC} Dumping source database..."
DUMP_FILE="/tmp/${SOURCE_DB}_dump_$(date +%s).sql"
pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${SOURCE_DB}" -F p -f "${DUMP_FILE}"
echo -e "${GREEN}✓${NC} Database dumped to ${DUMP_FILE}"

echo -e "${YELLOW}[5/5]${NC} Restoring to target database..."
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TARGET_DB}" -f "${DUMP_FILE}" > /dev/null
echo -e "${GREEN}✓${NC} Database restored"

echo -e "${YELLOW}Cleaning up...${NC}"
rm -f "${DUMP_FILE}"
echo -e "${GREEN}✓${NC} Dump file removed"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Database Copy Completed Successfully ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "Database '${SOURCE_DB}' has been copied to '${TARGET_DB}'"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update DATABASE_URL in .env to point to ${TARGET_DB} if needed"
echo "2. Or configure it in Database Configuration UI (/settings/database-config)"
echo "3. Restart the server to use the new database"
echo ""
